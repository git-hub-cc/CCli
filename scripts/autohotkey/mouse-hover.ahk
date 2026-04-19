#Requires AutoHotkey v2.0
#NoTrayIcon
SetWorkingDir(A_ScriptDir)
CoordMode("Mouse", "Screen")

SafeAppend(Text) {
    try {
        FileAppend(Text, "*", "UTF-8")
    } catch {
        ; 静默忽略句柄失效异常
    }
}

if (A_Args.Length < 2) {
    SafeAppend("【执行异常】参数不足！请至少提供悬停目标的 X 和 Y 坐标。`n")
    ExitApp(1)
}

X := A_Args[1]
Y := A_Args[2]
HoverTime := (A_Args.Has(3) && A_Args[3] != "") ? A_Args[3] : 1000

try {
    MouseMove(X, Y, 0)
    Sleep(HoverTime)
    SafeAppend("【成功】鼠标悬停动作执行完毕 (坐标: " X "," Y " 持续时长: " HoverTime "ms)。`n")
    ExitApp(0)
} catch as err {
    SafeAppend("【执行异常】鼠标悬停失败: " err.Message "`n")
    ExitApp(1)
}