#Requires AutoHotkey v2.0
#NoTrayIcon
SetWorkingDir(A_ScriptDir)

SafeAppend(Text) {
    try {
        FileAppend(Text, "*", "UTF-8")
    } catch {
        ; 静默忽略句柄失效异常
    }
}

if (A_Args.Length < 2) {
    SafeAppend("【执行异常】参数不足！需提供：窗口标题或进程名, 动作(Close/Minimize/Maximize/Restore/Activate)`n")
    ExitApp(1)
}

Target := A_Args[1]
Action := A_Args[2]

if (RegExMatch(Target, "i)\.exe$")) {
    Target := "ahk_exe " Target
}

if !WinExist(Target) {
    SafeAppend("【执行异常】未找到匹配的窗口: " Target "`n")
    ExitApp(1)
}

try {
    switch Action, "Off" {
        case "Close", "C": WinClose(Target)
        case "Minimize", "Min": WinMinimize(Target)
        case "Maximize", "Max": WinMaximize(Target)
        case "Restore", "R": WinRestore(Target)
        case "Activate", "A": WinActivate(Target)
        default:
            SafeAppend("【执行异常】不支持的动作: " Action "`n")
            ExitApp(1)
    }
    SafeAppend("【成功】窗口动作 " Action " 已对 " Target " 执行完毕。`n")
    ExitApp(0)
} catch as err {
    SafeAppend("【执行异常】窗口操作失败: " err.Message "`n")
    ExitApp(1)
}