import sys
import uiautomation as auto

def main():
    sys.stdout.reconfigure(encoding='utf-8')
    try:
        window = auto.GetForegroundControl()
        if not window:
            print("【系统自动反馈】未能获取到前台激活窗口。")
            return

        print(f"【前台窗口】: {window.Name} ({window.ClassName})")
        print("【可用交互控件树】:")

        control_types = [
            auto.ControlType.ButtonControl,
            auto.ControlType.EditControl,
            auto.ControlType.MenuItemControl,
            auto.ControlType.TabItemControl,
            auto.ControlType.ListItemControl,
            auto.ControlType.DocumentControl,
            auto.ControlType.HyperlinkControl
        ]

        count = 0
        # 控制遍历深度和最大提取数量，防止某些重度 UI 软件卡死
        for control, depth in auto.WalkTree(window, getDepth=True, maxDepth=4):
            if control.ControlType in control_types or (control.Name and depth <= 2):
                rect = control.BoundingRectangle
                if rect.width() > 0 and rect.height() > 0:
                    print(f"[{control.ControlTypeName}] Name: '{control.Name}', 绝对坐标: ({rect.left},{rect.top}) 尺寸: {rect.width()}x{rect.height()}")
                    count += 1
                
                if count >= 40:
                    print("... (结果已截断，防止超出上下文限制)")
                    break
                    
    except Exception as e:
        print(f"【系统自动反馈】UI控件探测失败，可能因权限不足或目标架构不支持: {e}")

if __name__ == '__main__':
    main()