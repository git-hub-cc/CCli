#Requires AutoHotkey v2.0
#NoTrayIcon
SendMode("Input")
SetWorkingDir(A_ScriptDir)

if (A_Args.Length < 1) {
    FileAppend("【执行异常】参数不足！请提供需要输入的文本或按键组合。`n", "*", "UTF-8")
    ExitApp(1)
}

InputText := A_Args[1]

try {
    SetImeStatus(0)
    Sleep(200)

    Send(InputText)
    FileAppend("【成功】键盘输入指令执行完毕。`n", "*", "UTF-8")
    ExitApp(0)
} catch as err {
    FileAppend("【执行异常】键盘输入失败: " err.Message "`n", "*", "UTF-8")
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