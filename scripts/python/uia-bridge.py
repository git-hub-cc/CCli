import sys
import json
import argparse
import subprocess

# --- 依赖自动安装模块 ---
def ensure_dependencies():
    try:
        import uiautomation
    except ImportError:
        print(json.dumps({"status": "info", "message": "正在自动安装依赖 uiautomation..."}), file=sys.stderr)
        try:
            subprocess.check_call([sys.executable, "-m", "pip", "install", "uiautomation>=3.0.0"], stdout=subprocess.DEVNULL)
            print(json.dumps({"status": "info", "message": "依赖安装成功"}), file=sys.stderr)
        except subprocess.CalledProcessError as e:
            print(json.dumps({"status": "error", "message": f"自动安装依赖失败: {e}"}))
            sys.exit(1)

ensure_dependencies()

# 确保在 import uiautomation 之前安装完毕
import uiautomation as auto
# -------------------------

def get_window(target):
    """
    获取目标窗口：遍历桌面顶层窗口，严格过滤掉物理尺寸为 0x0 的幽灵/隐藏窗口
    """
    for win in auto.GetRootControl().GetChildren():
        if win.Name == target or win.ClassName == target:
            rect = win.BoundingRectangle
            if rect.width() > 0 and rect.height() > 0:
                return win
    return None

def get_control_by_id(window, target_id):
    current_id = 1
    for control, depth in auto.WalkControl(window, includeTop=False, maxDepth=7):
        if control.ControlType not in [auto.ControlType.PaneControl, auto.ControlType.WindowControl, auto.ControlType.GroupControl]:
            if current_id == target_id:
                return control
            current_id += 1
    return None

def action_scan(target):
    win = get_window(target)
    if not win:
        return {"status": "error", "message": f"未找到可见的窗口: {target}"}

    win.SetActive()
    elements = []
    current_id = 1

    # 适当放宽扫描深度至 7，以适配微信、浏览器等嵌套较深的现代应用
    for control, depth in auto.WalkControl(win, includeTop=False, maxDepth=7):
        if control.ControlType not in [auto.ControlType.PaneControl, auto.ControlType.WindowControl, auto.ControlType.GroupControl]:
            name = control.Name.strip()[:40] if control.Name else ""
            elements.append({
                "id": current_id,
                "type": control.ControlTypeName,
                "name": name
            })
            current_id += 1
            if current_id > 150:
                break

    return {"status": "success", "elements": elements}

def action_interact(action, target, control_id, value=None):
    win = get_window(target)
    if not win:
        return {"status": "error", "message": f"未找到可见的窗口: {target}"}
    
    win.SetActive()
    
    if action == 'scroll':
        if value == 'up':
            auto.WheelUp(wheelTimes=3)
        else:
            auto.WheelDown(wheelTimes=3)
        return {"status": "success", "message": "成功执行滚动操作"}
        
    control = get_control_by_id(win, int(control_id))
    if not control:
        return {"status": "error", "message": f"未找到ID为 {control_id} 的控件，请重新scan"}

    try:
        if action == 'click':
            control.Click(simulateMove=False)
            return {"status": "success", "message": f"成功点击控件 [{control_id}]"}
        elif action == 'fill':
            if hasattr(control, 'SetValue'):
                control.SetValue(value)
            else:
                control.Click(simulateMove=False)
                auto.SendKeys(value)
            return {"status": "success", "message": f"成功在控件 [{control_id}] 填入文本"}
        else:
            return {"status": "error", "message": f"不支持的操作: {action}"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--action", required=True)
    parser.add_argument("--target", required=True)
    parser.add_argument("--id", required=False)
    parser.add_argument("--value", required=False)
    
    args = parser.parse_args()
    
    auto.SetGlobalSearchTimeout(3)
    
    result = {}
    if args.action == "scan":
        result = action_scan(args.target)
    elif args.action in ["click", "fill", "scroll"]:
        result = action_interact(args.action, args.target, args.id, args.value)
    else:
        result = {"status": "error", "message": "未知操作"}
        
    print(json.dumps(result, ensure_ascii=False))

if __name__ == "__main__":
    main()