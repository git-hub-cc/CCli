import { BaseAction, ActionResult } from './base.js';
import { sysLogger, LogLevel } from '../core/logger.js';
import { Adb } from '@devicefarmer/adbkit';

/**
 * 处理 <device> 标签：跨端物理设备控制
 * 通过纯 TS 实现的 ADB 协议，直连 Android 物理设备或模拟器
 */
export class DeviceAction extends BaseAction {
    tag = 'device';

    // 修复 TS2339：将类型设为 any 以避开 adbkit 不准确的类型定义限制
    // 这样可以直接调用 .shell(), .listDevices() 等方法而不会报类型错误
    private static adbClient: any = Adb.createClient();

    async execute(attributes: Record<string, string>, content: string): Promise<ActionResult> {
        const action = (attributes['action'] || '').toLowerCase();
        const targetId = attributes['target'];

        if (!action) {
            throw new Error('<device> 标签缺少必填属性 action (connect/tap/swipe/keyevent/shell)');
        }

        sysLogger.log(LogLevel.ACTION, `准备执行物理设备控制: ${action}`);

        try {
            // 自动寻找活跃设备
            let deviceId = targetId;
            if (!deviceId) {
                const devices = await DeviceAction.adbClient.listDevices();
                const onlineDevices = devices.filter((d: any) => d.type !== 'offline');

                if (onlineDevices.length === 0) {
                    throw new Error('未检测到任何在线的 ADB 设备。请确保设备已连接并开启 USB 调试。');
                }

                // 默认使用列表中第一个在线的设备
                deviceId = onlineDevices[0].id;
                sysLogger.log(LogLevel.INFO, `自动命中目标设备: ${deviceId}`);
            }

            // 根据不同的 action 执行相应的底层 ADB 命令
            switch (action) {
                case 'shell': {
                    const cmd = content.trim();
                    if (!cmd) throw new Error('执行 shell 缺少具体命令内容');

                    // 利用 adbkit 的 shell 执行原生命令
                    const stream = await DeviceAction.adbClient.shell(deviceId, cmd);
                    const output = await Adb.util.readAll(stream);
                    const resultText = output.toString('utf8').trim();

                    sysLogger.log(LogLevel.SUCCESS, `设备 Shell 命令已执行。`);
                    return {
                        type: 'device',
                        content: `【系统自动反馈：设备 Shell 结果】\n设备: ${deviceId}\n输出:\n${resultText}`
                    };
                }

                case 'tap': {
                    const x = attributes['x'];
                    const y = attributes['y'];
                    if (!x || !y) throw new Error('tap 动作缺少 x 或 y 坐标属性');

                    await DeviceAction.adbClient.shell(deviceId, `input tap ${x} ${y}`);
                    sysLogger.log(LogLevel.SUCCESS, `已向设备发送物理点击事件: (${x}, ${y})`);

                    return {
                        type: 'device',
                        content: `【系统自动反馈】已成功向移动设备发送屏幕点击指令。`
                    };
                }

                case 'swipe': {
                    const x1 = attributes['x1'];
                    const y1 = attributes['y1'];
                    const x2 = attributes['x2'];
                    const y2 = attributes['y2'];
                    const duration = attributes['duration'] || '500';

                    if (!x1 || !y1 || !x2 || !y2) throw new Error('swipe 动作缺少必须的坐标系参数');

                    await DeviceAction.adbClient.shell(deviceId, `input swipe ${x1} ${y1} ${x2} ${y2} ${duration}`);
                    sysLogger.log(LogLevel.SUCCESS, `已向设备发送滑动事件: (${x1},${y1}) -> (${x2},${y2})`);

                    return {
                        type: 'device',
                        content: `【系统自动反馈】已成功向移动设备发送屏幕滑动指令。`
                    };
                }

                case 'keyevent': {
                    const keycode = attributes['key'] || content.trim();
                    if (!keycode) throw new Error('keyevent 动作缺少按键代码 (key 属性或文本内容)');

                    await DeviceAction.adbClient.shell(deviceId, `input keyevent ${keycode}`);
                    sysLogger.log(LogLevel.SUCCESS, `已向设备发送物理按键: ${keycode}`);

                    return {
                        type: 'device',
                        content: `【系统自动反馈】已成功向移动设备发送物理按键指令 (${keycode})。`
                    };
                }

                case 'connect': {
                    const host = attributes['host'] || content.trim();
                    if (!host) throw new Error('connect 动作缺少目标主机 IP 和端口');

                    const [ip, portStr] = host.split(':');
                    const port = parseInt(portStr || '5555', 10);

                    await DeviceAction.adbClient.connect(ip, port);
                    sysLogger.log(LogLevel.SUCCESS, `已成功连接至无线设备: ${host}`);

                    return {
                        type: 'device',
                        content: `【系统自动反馈】ADB 网络协议已成功握手，设备 ${host} 已上线。`
                    };
                }

                default:
                    throw new Error(`不支持的跨端设备动作: ${action}`);
            }

        } catch (err: any) {
            sysLogger.log(LogLevel.ERROR, `物理设备操作异常: ${err.message}`);
            throw new Error(`物理设备操作发生异常: ${err.message}\n请检查设备 ADB 调试权限或驱动状态。`);
        }
    }
}