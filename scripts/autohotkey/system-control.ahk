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
    SafeAppend("【执行异常】参数不足！请提供系统控制指令。`n")
    ExitApp(1)
}

Action := A_Args[1]

try {
    switch Action, "Off" {
        case "VolumeUp": SoundSetVolume("+5")
        case "VolumeDown": SoundSetVolume("-5")
        case "Mute": SoundSetMute(-1)
        case "LockScreen": DllCall("user32\LockWorkStation")
        case "EmptyTrash": FileRecycleEmpty()
        default:
            SafeAppend("【执行异常】不支持的系统指令: " Action "`n")
            ExitApp(1)
    }
    SafeAppend("【成功】系统状态控制指令 [" Action "] 已执行完毕。`n")
    ExitApp(0)
} catch as err {
    SafeAppend("【执行异常】系统控制执行失败: " err.Message "`n")
    ExitApp(1)
}