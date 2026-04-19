#Requires AutoHotkey v2.0
#NoTrayIcon
SetWorkingDir(A_ScriptDir)
CoordMode("Mouse", "Screen")

; 确保标准输出安全写入 (刚才你漏掉了这一段)
SafeAppend(Text) {
    try {
        FileAppend(Text, "*", "UTF-8")
    } catch {
        ; 忽略句柄失效异常
    }
}

; 参数校验
if (A_Args.Length < 4) {
    SafeAppend("【执行异常】参数不足！请至少提供起点和终点的 X、Y 坐标。`n")
    ExitApp(1)
}

try {
    X1 := Number(A_Args[1])
    Y1 := Number(A_Args[2])
    X2 := Number(A_Args[3])
    Y2 := Number(A_Args[4])
    Speed := (A_Args.Has(5) && A_Args[5] != "") ? Number(A_Args[5]) : 15

    ; 切换到 Event 模式，它更接近人类真实的物理鼠标输入，对拖拽动作的兼容性更好
    SendMode("Event")

    ; 先移动到起点稍作停顿，确保目标窗口获得焦点
    MouseMove(X1, Y1, 0)
    Sleep(150)

    ; 使用内置的拖拽函数 (按键, 起点X, 起点Y, 终点X, 终点Y, 速度)
    MouseClickDrag("Left", X1, Y1, X2, Y2, Speed)

    ; 拖拽完成后稍作延迟
    Sleep(100)

    SafeAppend("【成功】鼠标拖拽执行完毕 (内置拖拽模式: " X1 "," Y1 " -> " X2 "," Y2 ")。`n")
    ExitApp(0)

} catch as err {
    SafeAppend("【执行异常】鼠标拖拽失败 (" type(err) "): " err.Message "`n")
    ExitApp(1)
}