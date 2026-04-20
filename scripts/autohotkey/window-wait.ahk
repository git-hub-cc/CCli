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

if (A_Args.Length < 1) {
    SafeAppend("【执行异常】参数不足！请提供需要等待的窗口标题或进程名。`n")
    ExitApp(1)
}

Target := A_Args[1]
Timeout := (A_Args.Has(2) && A_Args[2] != "") ? Number(A_Args[2]) : 30

if (Timeout > 30) {
    Timeout := 30
}

if (RegExMatch(Target, "i)\.exe$")) {
    Target := "ahk_exe " Target
}

try {
    if !WinWait(Target, , Timeout) {
        SafeAppend("【系统自动反馈】等待窗口就绪超时 (" Timeout "秒): " Target "，已自动结束等待并放行流程。`n")
        ExitApp(0)
    }

    WinActivate(Target)
    if !WinWaitActive(Target, , 5) {
        SafeAppend("【系统自动反馈】窗口已存在，但尝试将其激活到前台超时，已自动结束等待并放行流程。请检查是否被其他更高层级窗口遮挡。`n")
        ExitApp(0)
    }

    SafeAppend("【成功】目标窗口已完全就绪并激活至前台。`n")
    ExitApp(0)
} catch as err {
    SafeAppend("【执行异常】等待窗口过程中发生异常: " err.Message "`n")
    ExitApp(1)
}