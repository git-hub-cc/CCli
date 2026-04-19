#Requires AutoHotkey v2.0
#NoTrayIcon
SendMode("Input")
SetWorkingDir(A_ScriptDir)

; --- 1. 配置变量 ---
WeChatExe := "Weixin.exe"

; --- 2. 激活窗口并发送登录指令 ---
if WinExist("ahk_exe " WeChatExe) {
    WinActivate("ahk_exe " WeChatExe)
    if WinWaitActive("ahk_exe " WeChatExe, , 5) {
        Send("{Enter}") ; 发送回车键点击登录按钮
        Sleep(6000) ; 等待主界面加载
    } else {
        FileAppend("【错误】微信登录窗口激活超时。`n", "*", "UTF-8")
        ExitApp(1)
    }
} else {
    FileAppend("【错误】未找到微信窗口，请先启动微信进程。`n", "*", "UTF-8")
    ExitApp(1)
}

; --- 3. 最终窗口状态校验 ---
WinActivate("ahk_exe " WeChatExe)
if WinWaitActive("ahk_exe " WeChatExe, , 8) {
    FileAppend("【成功】微信登录操作执行完毕并成功激活主窗口。`n", "*", "UTF-8")
    ExitApp(0)
} else {
    FileAppend("【错误】微信主界面窗口激活超时。`n", "*", "UTF-8")
    ExitApp(1)
}