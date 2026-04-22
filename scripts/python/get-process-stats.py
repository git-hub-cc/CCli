import sys
import subprocess

def get_process_stats():
    sys.stdout.reconfigure(encoding='utf-8')
    
    if len(sys.argv) < 2 or not sys.argv[1].strip():
        print("【执行异常】参数不足！请提供需要查询的进程名称 (例如 weixin.exe) 或 PID。")
        return

    target = sys.argv[1].strip().lower()
    
    # 智能补全常见进程后缀
    if not target.endswith('.exe') and not target.isdigit():
        target += '.exe'

    try:
        # 调用 Windows 原生 tasklist 工具，CSV格式易于解析
        result = subprocess.check_output(['tasklist', '/NH', '/FO', 'CSV'], text=True)
        lines = result.splitlines()
        
        found_processes = []
        total_mem_kb = 0

        for line in lines:
            if not line.strip():
                continue
            
            parts = line.replace('"', '').split(',')
            if len(parts) >= 5:
                proc_name = parts[0].lower()
                pid = parts[1]
                session_name = parts[2]
                mem_usage_str = parts[4]
                
                if target in proc_name or target == pid:
                    # 提取数值部分计算总内存
                    mem_val = ''.join(filter(str.isdigit, mem_usage_str))
                    if mem_val:
                        total_mem_kb += int(mem_val)
                    
                    found_processes.append(f"-> 进程名: {parts[0]}, PID: {pid}, 会话: {session_name}, 内存占用: {mem_usage_str}")
        
        if not found_processes:
            print(f"【系统自动反馈】未找到运行中的进程: {target}。这可能意味着程序尚未启动、已闪退或名称不匹配。")
            return
            
        print(f"【进程状态反馈: 命中 {len(found_processes)} 个实例】")
        
        limit = 10
        for p in found_processes[:limit]:
            print(p)
            
        if len(found_processes) > limit:
            print(f"... (结果已截断，省略其余 {len(found_processes) - limit} 个同名实例)")
            
        # 简单换算为 MB 供直观阅读
        total_mem_mb = total_mem_kb / 1024
        print(f"\n>> 该进程族当前总内存占用预估: {total_mem_mb:.2f} MB")
        
        # 启发式判断建议
        if total_mem_mb < 5.0 and len(found_processes) == 1:
            print(">> [启发式提示]: 目标内存占用极低，可能处于刚启动阶段或被挂起。")
            
    except Exception as e:
        print(f"【执行异常】获取进程状态失败: {e}")

if __name__ == '__main__':
    get_process_stats()