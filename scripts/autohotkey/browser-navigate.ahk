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

if (A_Args.Length < 2) {
    SafeAppend("【执行异常】参数不足！请提供目标浏览器和需要跳转的 URL。`n")
    ExitApp(1)
}

Target := A_Args[1]
Url := A_Args[2]

if (RegExMatch(Target, "i)\.exe$")) {
    Target := "ahk_exe " Target
}

if !WinExist(Target) {
    SafeAppend("【动作被拒绝】未找到匹配的浏览器窗口: " Target "`n")
    ExitApp(1)
}

try {
    WinActivate(Target)
    if !WinWaitActive(Target, , 5) {
        SafeAppend("【动作被拒绝】尝试激活浏览器窗口超时。请检查窗口是否被阻塞。`n")
        ExitApp(1)
    }

    ; 切换至英文输入法，避免输入法拦截快捷键
    SetImeStatus(0)
    Sleep(300)

    ; 发送 Ctrl+L 聚焦浏览器的地址栏
    Send("^l")
    Sleep(400)

    ; 使用剪贴板写入长 URL，提升输入稳定性和速度
    SavedClip := ClipboardAll()
    A_Clipboard := ""
    A_Clipboard := Url
    
    if !ClipWait(2) {
        SafeAppend("【执行异常】剪贴板写入 URL 超时！`n")
        ExitApp(1)
    }

    Send("^v")
    Sleep(300)
    Send("{Enter}")
    Sleep(500)

    ; 恢复原有剪贴板内容
    A_Clipboard := SavedClip
    SavedClip := ""

    SafeAppend("【成功】浏览器已成功接收跳转指令: " Url "`n")
    ExitApp(0)
} catch as err {
    SafeAppend("【执行异常】浏览器导航操作失败: " err.Message "`n")
    ExitApp(1)
}

SetImeStatus(State) {
    try {
        hWnd := WinGetID("A")
        DefaultIMEWnd := DllCall("imm32\ImmGetDefaultIMEWnd", "Ptr", hWnd, "Ptr")
        if (DefaultIMEWnd) {
            SendMessage(0x0283, 0x0006, State, , "ahk_id " DefaultIMEWnd)
        }
    }
}