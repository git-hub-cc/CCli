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

TargetExe := "Feishu.exe"

; --- 2. 前置状态校验 ---
if !WinExist("ahk_exe " TargetExe) {
    FileAppend("【动作被拒绝】未找到飞书窗口。请先使用 get-app-paths 获取飞书的绝对路径并使用 <act> 启动它，或提示用户手动打开后再尝试。`n", "*", "UTF-8")
    ExitApp(1)
}

WinActivate("ahk_exe " TargetExe)
if !WinWaitActive("ahk_exe " TargetExe, , 5) {
    FileAppend("【动作被拒绝】无法将飞书窗口激活到前台，发送操作已中止。可能飞书未完全加载或处于未登录状态，请先查验状态。`n", "*", "UTF-8")
    ExitApp(1)
}

; 强制切换英文输入法避免快捷键被拦截
SetImeStatus(0)
Sleep(300)

; --- 3. 触发全局搜索并进入会话 ---
Send("^k")
Sleep(600)

SavedClip := ClipboardAll()
A_Clipboard := ""
A_Clipboard := SearchTerm
if !ClipWait(2) {
    FileAppend("【执行异常】剪贴板写入搜索词超时！`n", "*", "UTF-8")
    ExitApp(1)
}

Send("^v")
Sleep(1500) ; 等待飞书服务端检索结果并渲染列表
Send("{Enter}")
Sleep(1000) ; 等待聊天面板加载就绪

; --- 4. 发送文本消息 ---
if (TextMessage != "") {
    A_Clipboard := ""
    A_Clipboard := TextMessage
    if !ClipWait(2) {
        FileAppend("【执行异常】剪贴板写入文本超时！`n", "*", "UTF-8")
        ExitApp(1)
    }
    Send("^v")
    Sleep(400)
    Send("{Enter}")
    Sleep(500)
}

; --- 5. 发送文件附件 ---
if (FilePath != "" && FileExist(FilePath)) {
    psCommand := "PowerShell -NoProfile -Command `"Set-Clipboard -Path '" FilePath "'`""
    RunWait(psCommand, , "Hide")
    Sleep(600)
    Send("^v")
    Sleep(2000) ; 等待飞书读取本地文件并生成上传预览缩略图
    Send("{Enter}")
}

; 恢复用户剪贴板
A_Clipboard := SavedClip
SavedClip := ""

FileAppend("【成功】飞书消息指令执行完毕。`n", "*", "UTF-8")
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