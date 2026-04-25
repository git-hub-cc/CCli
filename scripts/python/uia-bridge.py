import sys
import json
import argparse
import subprocess
import time

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

def is_valid_element(control):
    """
    清洗规则：过滤掉没有名字的纯布局容器，减少大模型的噪音
    """
    # 新增：全局拦截并丢弃所有 TextControl
    if control.ControlType == auto.ControlType.TextControl:
        return False

    if control.ControlType in [auto.ControlType.PaneControl, auto.ControlType.WindowControl, auto.ControlType.GroupControl]:
        return bool(control.Name and control.Name.strip())
    return True

def get_control_by_id(window, target_id):
    current_id = 1
    # 队列中同时记录节点和其所处的深度：(control, depth)
    queue = [(window, 0)]
    start_time = time.time()
    max_depth = 12
    
    while queue:
        if time.time() - start_time > 10:
            break
        curr, depth = queue.pop(0)
        
        # 深度限制护栏：超过指定层级不再继续下钻
        if depth >= max_depth:
            continue
            
        try:
            children = curr.GetChildren()
        except Exception:
            continue
            
        for c in children:
            rect = c.BoundingRectangle
            if rect and rect.width() > 0 and rect.height() > 0:
                if is_valid_element(c):
                    if current_id == target_id:
                        return c
                    current_id += 1
                # 将子节点压入队列，深度 +1
                queue.append((c, depth + 1))
                
    return None

def action_scan(target):
    win = get_window(target)
    if not win:
        return {"status": "error", "message": f"未找到可见的窗口: {target}"}

    win.SetActive()
    elements = []
    current_id = 1
    # 队列中同时记录节点和其所处的深度：(control, depth)
    queue = [(win, 0)]
    start_time = time.time()
    
    max_depth = 20       # 限制最大扫描深度为 20 层
    max_elements = 600   # 限制最多提取 600 个有效元素，防止大模型上下文爆炸

    while queue:
        if time.time() - start_time > 10:
            break
        curr, depth = queue.pop(0)
        
        # 深度限制护栏：超过指定层级不再继续下钻
        if depth >= max_depth:
            continue
            
        try:
            children = curr.GetChildren()
        except Exception:
            continue
            
        for c in children:
            rect = c.BoundingRectangle
            if rect and rect.width() > 0 and rect.height() > 0:
                if is_valid_element(c):
                    name = c.Name.strip()[:40] if c.Name else ""
                    bbox = {"x": rect.left, "y": rect.top, "w": rect.width(), "h": rect.height()}
                    
                    elements.append({
                        "id": current_id,
                        "type": c.ControlTypeName,
                        "name": name,
                        "bbox": bbox
                    })
                    current_id += 1
                    
                    if current_id > max_elements:
                        break
                # 将子节点压入队列，深度 +1
                queue.append((c, depth + 1))
                
        if current_id > max_elements:
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