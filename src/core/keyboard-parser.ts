import { Key } from '@nut-tree/nut-js';

export interface KeyboardInstruction {
    type: 'text' | 'hotkey';
    text?: string;
    modifiers?: Key[];
    key?: Key;
    repeat?: number;
}

const modifierMap: Record<string, Key> = {
    'ctrl': Key.LeftControl,
    'control': Key.LeftControl,
    'alt': Key.LeftAlt,
    'shift': Key.LeftShift,
    'win': Key.LeftSuper,
    'super': Key.LeftSuper,
    'meta': Key.LeftSuper,
};

const specialKeyMap: Record<string, Key> = {
    'enter': Key.Return,
    'return': Key.Return,
    'esc': Key.Escape,
    'escape': Key.Escape,
    'tab': Key.Tab,
    'space': Key.Space,
    'up': Key.Up,
    'down': Key.Down,
    'left': Key.Left,
    'right': Key.Right,
    'backspace': Key.Backspace,
    'del': Key.Delete,
    'delete': Key.Delete,
    'home': Key.Home,
    'end': Key.End,
    'pageup': Key.PageUp,
    'pagedown': Key.PageDown,
    'f1': Key.F1, 'f2': Key.F2, 'f3': Key.F3, 'f4': Key.F4,
    'f5': Key.F5, 'f6': Key.F6, 'f7': Key.F7, 'f8': Key.F8,
    'f9': Key.F9, 'f10': Key.F10, 'f11': Key.F11, 'f12': Key.F12,
};

const charKeyMap: Record<string, Key> = {
    'a': Key.A, 'b': Key.B, 'c': Key.C, 'd': Key.D, 'e': Key.E,
    'f': Key.F, 'g': Key.G, 'h': Key.H, 'i': Key.I, 'j': Key.J,
    'k': Key.K, 'l': Key.L, 'm': Key.M, 'n': Key.N, 'o': Key.O,
    'p': Key.P, 'q': Key.Q, 'r': Key.R, 's': Key.S, 't': Key.T,
    'u': Key.U, 'v': Key.V, 'w': Key.W, 'x': Key.X, 'y': Key.Y, 'z': Key.Z,
    '0': Key.Num0, '1': Key.Num1, '2': Key.Num2, '3': Key.Num3, '4': Key.Num4,
    '5': Key.Num5, '6': Key.Num6, '7': Key.Num7, '8': Key.Num8, '9': Key.Num9,
};

export class KeyboardParser {
    static parse(input: string): KeyboardInstruction[] {
        const instructions: KeyboardInstruction[] = [];

        const parts = input.toLowerCase().split('+').map(p => p.trim()).filter(Boolean);

        const modifiers: Key[] = [];
        let mainKey: Key | undefined;

        for (const part of parts) {
            if (modifierMap[part]) {
                modifiers.push(modifierMap[part]);
            } else if (specialKeyMap[part]) {
                mainKey = specialKeyMap[part];
            } else if (charKeyMap[part]) {
                mainKey = charKeyMap[part];
            }
        }

        if (mainKey) {
            instructions.push({
                type: 'hotkey',
                modifiers: modifiers,
                key: mainKey,
                repeat: 1
            });
        } else if (modifiers.length > 0) {
            instructions.push({
                type: 'hotkey',
                modifiers: [],
                key: modifiers[0],
                repeat: 1
            });
        }

        return instructions;
    }
}