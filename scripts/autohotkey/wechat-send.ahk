#Requires AutoHotkey v2.0
#NoTrayIcon
SendMode("Input")
SetWorkingDir(A_ScriptDir)

; --- 1. 读取参数 ---
SearchTerm  := A_Args.Has(1) ? A_Args[1] : ""
TextMessage := A_Args.Has(2) ? A_Args[2] : ""
FilePath    := A_Args.Has(3) ? A_Args[3] : ""

if (SearchTerm = "" || (TextMessage = "" && FilePath = "")) {
    FileAppend("【执行异常】参数不足！请至少提供搜索词，以及文本或文件之一。`n", "*", "UTF-8")
    ExitApp(1)
}

WeChatExe := "Weixin.exe"

; --- 2. 严格的前置校验 ---
if !WinExist("ahk_exe " WeChatExe) {
    FileAppend("【动作被拒绝】未找到微信窗口。请先使用 list-apps 获取微信的绝对路径并使用 <act> 启动它，或提示用户手动打开后再尝试。`n", "*", "UTF-8")
    ExitApp(1)
}

WinActivate("ahk_exe " WeChatExe)
if !WinWaitActive("ahk_exe " WeChatExe, , 5) {
    FileAppend("【动作被拒绝】无法将微信窗口激活到前台，发送操作已中止。可能微信未完全加载或处于未登录状态，请先查验状态。`n", "*", "UTF-8")
    ExitApp(1)
}

; 强制切换英文输入法避免中文劫持快捷键
SetImeStatus(0)
Sleep(200)

; --- 3. 搜索联系人 ---
Send("^f")
Sleep(500)
Send("{Text}" SearchTerm)
Sleep(1200) ; 等待搜索结果列表弹出
Send("{Enter}")
Sleep(800)

; --- 4. 发送文本消息 ---
if (TextMessage != "") {
    SavedClip := ClipboardAll()
    A_Clipboard := ""
    A_Clipboard := TextMessage
    if !ClipWait(2) {
        FileAppend("【执行异常】剪贴板写入文本超时！`n", "*", "UTF-8")
        ExitApp(1)
    }
    Send("^v")
    Sleep(300)
    Send("{Enter}")
    Sleep(500)
    A_Clipboard := SavedClip
    SavedClip := ""
}

; --- 5. 发送文件 ---
if (FilePath != "" && FileExist(FilePath)) {
    psCommand := "PowerShell -NoProfile -Command `"Set-Clipboard -Path '" FilePath "'`""
    RunWait(psCommand, , "Hide")
    Sleep(500)
    Send("^v")
    Sleep(2000) ; 等待微信读取文件并渲染缩略图
    Send("{Enter}")
}

FileAppend("【成功】消息指令执行完毕。`n", "*", "UTF-8")
ExitApp(0)

; --- 辅助函数 ---
SetImeStatus(State) {
    try {
        hWnd := WinGetID("A")
        DefaultIMEWnd := DllCall("imm32\ImmGetDefaultIMEWnd", "Ptr", hWnd, "Ptr")
        if (DefaultIMEWnd) {
            SendMessage(0x0283, 0x0006, State, , "ahk_id " DefaultIMEWnd)
        }
    }
}