#Requires AutoHotkey v2.0
#NoTrayIcon
SetWorkingDir(A_ScriptDir)

; 封装安全输出函数，防止标准输出管道被外部关闭时抛出 (6) The handle is invalid
SafeAppend(Text) {
    try {
        FileAppend(Text, "*", "UTF-8")
    } catch {
        ; 静默忽略句柄失效异常
    }
}

if (A_Args.Length < 1) {
    SafeAppend("【执行异常】参数不足！请提供操作类型 (Read/Write)。`n")
    ExitApp(1)
}

Action := A_Args[1]

try {
    if (Action = "Read" || Action = "R") {
        Content := A_Clipboard
        if (Content = "") {
            SafeAppend("【系统自动反馈】剪贴板当前为空或非文本内容。`n")
        } else {
            SafeAppend("【系统自动反馈：剪贴板内容】`n" Content "`n")
        }
        ExitApp(0)
    } else if (Action = "Write" || Action = "W") {
        if (A_Args.Length < 2) {
            SafeAppend("【执行异常】写入操作需要提供文本参数。`n")
            ExitApp(1)
        }

        Text := A_Args[2]

        ; 关键修复：写入前必须先清空剪贴板，否则 ClipWait 可能会引发死锁等待
        A_Clipboard := ""
        A_Clipboard := Text

        if !ClipWait(2) {
            SafeAppend("【执行异常】剪贴板写入超时！`n")
            ExitApp(1)
        }

        SafeAppend("【成功】已将指定文本写入系统剪贴板。`n")
        ExitApp(0)
    } else {
        SafeAppend("【执行异常】未知的操作类型: " Action "`n")
        ExitApp(1)
    }
} catch as err {
    SafeAppend("【执行异常】剪贴板操作失败: " err.Message "`n")
    ExitApp(1)
}