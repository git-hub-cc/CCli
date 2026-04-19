#Requires AutoHotkey v2.0
#NoTrayIcon
SendMode("Input")
SetWorkingDir(A_ScriptDir)
CoordMode("Mouse", "Screen")

if (A_Args.Length < 2) {
    FileAppend("【执行异常】参数不足！请至少提供 X 和 Y 坐标。`n", "*", "UTF-8")
    ExitApp(1)
}

X := A_Args[1]
Y := A_Args[2]
Btn := (A_Args.Has(3) && A_Args[3] != "") ? A_Args[3] : "Left"
Clicks := (A_Args.Has(4) && A_Args[4] != "") ? A_Args[4] : 1

try {
    Click(X ", " Y ", " Btn ", " Clicks)
    FileAppend("【成功】鼠标点击执行完毕 (坐标: " X "," Y " 按键: " Btn " 次数: " Clicks ")。`n", "*", "UTF-8")
    ExitApp(0)
} catch as err {
    FileAppend("【执行异常】鼠标点击失败: " err.Message "`n", "*", "UTF-8")
    ExitApp(1)
}