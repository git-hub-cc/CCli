import os
import fnmatch
import sys

def load_ignore_patterns(filepath):
    patterns = []
    if os.path.exists(filepath):
        with open(filepath, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#'):
                    if line.startswith('/'):
                        line = line[1:]
                    patterns.append(line)
    return patterns

def is_ignored(rel_path, ignore_patterns):
    rel_path = rel_path.replace('\\', '/')
    parts = rel_path.split('/')
    
    for pattern in ignore_patterns:
        p = pattern.rstrip('/')
        
        for i in range(len(parts)):
            part_path = '/'.join(parts[i:])
            if fnmatch.fnmatch(part_path, p) or fnmatch.fnmatch(parts[i], p):
                return True

        if fnmatch.fnmatch(rel_path, p) or fnmatch.fnmatch(rel_path, f"*/{p}") or fnmatch.fnmatch(rel_path, f"{p}/*"):
            return True
            
    return False

def get_force_expand_dirs(ignore_patterns):
    force_expand = set()
    for pattern in ignore_patterns:
        p = pattern.replace('\\', '/').strip('/')
        parts = p.split('/')
        if len(parts) > 1:
            current = ""
            for part in parts[:-1]:
                current = current + "/" + part if current else part
                force_expand.add(current)
    return force_expand

def main():
    sys.stdout.reconfigure(encoding='utf-8')
    
    target_dir = sys.argv[1].strip() if len(sys.argv) > 1 and sys.argv[1].strip() else os.getcwd()
    if not os.path.isabs(target_dir):
        target_dir = os.path.abspath(os.path.join(os.getcwd(), target_dir))

    if not os.path.exists(target_dir):
        print(f"【系统自动反馈】目标路径不存在: {target_dir}")
        return

    ignore_patterns = ['.git', '.ccli', 'node_modules', 'dist', '__pycache__']
    cwd = os.getcwd()
    
    for base in [cwd, target_dir]:
        ignore_patterns.extend(load_ignore_patterns(os.path.join(base, '.gitignore')))
        ignore_patterns.extend(load_ignore_patterns(os.path.join(base, '.llmignore')))

    ignore_patterns = list(set(ignore_patterns))
    force_expand = get_force_expand_dirs(ignore_patterns)

    valid_paths = []

    for root, dirs, files in os.walk(target_dir):
        rel_root = os.path.relpath(root, target_dir).replace('\\', '/')
        if rel_root == '.':
            rel_root = ''

        next_dirs = []
        for d in dirs:
            rel_d = f"{rel_root}/{d}".strip('/')
            if not is_ignored(rel_d, ignore_patterns):
                valid_paths.append(rel_d + '/')
                if rel_d in force_expand:
                    next_dirs.append(d)
        dirs[:] = next_dirs

    if not valid_paths:
        print(f"【系统自动反馈：扫描结果】\n路径 '{target_dir}' 下没有发现可用目录，或全部被 ignore 规则屏蔽。")
        return

    valid_paths.sort()
    path_list_str = "\n".join(f"- {p}" for p in valid_paths)

    print(f"【系统自动反馈：目录结构扫描结果】")
    print(f"当前扫描基准路径: {target_dir}")
    print("已过滤忽略项，支持动态层级展开，有效目录如下：\n")
    print(path_list_str)

if __name__ == "__main__":
    main()