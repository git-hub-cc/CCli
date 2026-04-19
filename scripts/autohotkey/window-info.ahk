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
    SafeAppend("【执行异常】参数不足！请提供窗口标题或进程名。`n")
    ExitApp(1)
}

Target := A_Args[1]

if (RegExMatch(Target, "i)\.exe$")) {
    Target := "ahk_exe " Target
}

if !WinExist(Target) {
    SafeAppend("【执行异常】未找到匹配的窗口: " Target "`n")
    ExitApp(1)
}

try {
    WinGetPos(&X, &Y, &Width, &Height, Target)
    SafeAppend("【系统自动反馈：窗口物理信息】`n目标窗口: " Target "`n绝对坐标 (X, Y): " X ", " Y "`n物理尺寸 (宽 x 高): " Width " x " Height "`n")
    ExitApp(0)
} catch as err {
    SafeAppend("【执行异常】获取窗口信息失败: " err.Message "`n")
    ExitApp(1)
}