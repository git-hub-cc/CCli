import sys
import subprocess

def get_active_ports():
    sys.stdout.reconfigure(encoding='utf-8')
    target_port = sys.argv[1] if len(sys.argv) > 1 and sys.argv[1].strip() else None
    
    try:
        # 调用 Windows 原生 netstat 工具获取端口状态，无需额外安装第三方库
        result = subprocess.check_output(['netstat', '-ano'], text=True)
        lines = result.splitlines()
        
        occupied = []
        for line in lines:
            if 'LISTENING' in line or 'ESTABLISHED' in line:
                parts = line.split()
                if len(parts) >= 4:
                    proto = parts[0]
                    local_addr = parts[1]
                    state = parts[3]
                    pid = parts[4] if len(parts) > 4 else "N/A"
                    
                    if ':' in local_addr:
                        port = local_addr.rsplit(':', 1)[1]
                        if target_port:
                            if port == str(target_port):
                                occupied.append(f"协议: {proto.ljust(5)} | 端口: {port.ljust(5)} | 状态: {state.ljust(11)} | PID: {pid}")
                        else:
                            # 过滤掉系统内部通信端口，仅展示常规服务端口
                            if port.isdigit() and int(port) > 1024 and 'LISTENING' in state:
                                occupied.append(f"协议: {proto.ljust(5)} | 端口: {port.ljust(5)} | 状态: {state.ljust(11)} | PID: {pid}")
        
        if not occupied:
            if target_port:
                print(f"【系统自动反馈】检测完毕，端口 {target_port} 当前未被占用。")
            else:
                print("【系统自动反馈】未检测到正在监听的常规占用端口。")
            return
        
        # 去重并排序
        unique_ports = list(set(occupied))
        unique_ports.sort(key=lambda x: int(x.split('端口:')[1].split('|')[0].strip()) if x.split('端口:')[1].split('|')[0].strip().isdigit() else 0)
        
        print(f"【系统自动反馈：端口占用状态{' (指定端口: '+target_port+')' if target_port else ''}】")
        
        limit = 30
        for entry in unique_ports[:limit]:
            print(entry)
        
        if len(unique_ports) > limit:
            print(f"... (结果已截断，共检测到 {len(unique_ports)} 条记录)")
            
    except Exception as e:
        print(f"【执行异常】获取端口信息失败: {e}")

if __name__ == '__main__':
    get_active_ports()