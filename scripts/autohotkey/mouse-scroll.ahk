#Requires AutoHotkey v2.0
#NoTrayIcon
SendMode("Input")
SetWorkingDir(A_ScriptDir)

SafeAppend(Text) {
    try {
        FileAppend(Text, "*", "UTF-8")
    } catch {
        ; 静默忽略句柄失效异常
    }
}

if (A_Args.Length < 1) {
    SafeAppend("【执行异常】参数不足！请提供滚动方向 (Up/Down) 和可选的滚动次数。`n")
    ExitApp(1)
}

Direction := A_Args[1]
Lines := (A_Args.Has(2) && A_Args[2] != "") ? A_Args[2] : 1

try {
    if (Direction = "Up" || Direction = "U") {
        Click("WheelUp", Lines)
    } else if (Direction = "Down" || Direction = "D") {
        Click("WheelDown", Lines)
    } else {
        SafeAppend("【执行异常】未知的滚动方向: " Direction "`n")
        ExitApp(1)
    }
    SafeAppend("【成功】鼠标滚动执行完毕 (方向: " Direction ", 次数: " Lines ")。`n")
    ExitApp(0)
} catch as err {
    SafeAppend("【执行异常】鼠标滚动失败: " err.Message "`n")
    ExitApp(1)
}