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
ControlName := (A_Args.Has(2) && A_Args[2] != "") ? A_Args[2] : ""

if (RegExMatch(Target, "i)\.exe$")) {
    Target := "ahk_exe " Target
}

if !WinExist(Target) {
    SafeAppend("【执行异常】未找到匹配的窗口: " Target "`n")
    ExitApp(1)
}

try {
    if (ControlName = "") {
        ExtractedText := WinGetText(Target)
    } else {
        ExtractedText := ControlGetText(ControlName, Target)
    }
    
    if (ExtractedText = "") {
        SafeAppend("【系统自动反馈】提取成功，但目标区域文本当前为空。`n")
    } else {
        SafeAppend("【系统自动反馈：提取文本内容】`n" ExtractedText "`n")
    }
    ExitApp(0)
} catch as err {
    SafeAppend("【执行异常】提取文本失败: " err.Message "`n")
    ExitApp(1)
}