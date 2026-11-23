import { createStore } from "solid-js/store";
import { browser } from "wxt/browser";

export interface StorageStoreOptions<T extends object> {
    /** 同步初始值（首帧渲染用，storage 读完后会被覆盖） */
    initial: T;
    /** 从 storage 读取完整初始值（可做迁移 / 多 key 组合） */
    read: () => Promise<Partial<T>>;
    /** storage.onChanged 中的某个 key → store 补丁；返回 null 表示忽略 */
    mapChange: (key: string, newValue: unknown) => Partial<T> | null;
    /** 把补丁写回 storage（next 是写入后的完整值） */
    write: (next: T, patch: Partial<T>) => Promise<void>;
}

export interface StorageStore<T extends object> {
    store: T;
    init: () => Promise<void>;
    update: (patch: Partial<T>) => Promise<void>;
}

/**
 * Options / Popup 共用的「storage ↔ Solid store」骨架：
 * 初始化只跑一次、storage.onChanged 跨上下文同步、写入前等初始化完成。
 */
export function createStorageStore<T extends object>(
    options: StorageStoreOptions<T>,
): StorageStore<T> {
    const [store, setStore] = createStore<T>(options.initial);

    let initPromise: Promise<void> | null = null;

    const init = () => {
        if (initPromise) return initPromise;

        initPromise = (async () => {
            const patch = await options.read();
            setStore((prev) => ({ ...prev, ...patch }));
        })().catch((error) => {
            // 失败时允许下次重试，而不是把 rejected promise 永久缓存
            initPromise = null;
            throw error;
        });

        return initPromise;
    };

    browser.storage.onChanged.addListener((changes, area) => {
        if (area !== "local") return;

        const patch: Partial<T> = {};
        let changed = false;

        for (const key of Object.keys(changes)) {
            const change = changes[key];
            if (!change) continue;

            const mapped = options.mapChange(key, change.newValue);
            if (!mapped) continue;
            Object.assign(patch, mapped);
            changed = true;
        }

        if (changed) setStore((prev) => ({ ...prev, ...patch }));
    });

    const update = async (patch: Partial<T>) => {
        // 等初始配置读完再写，避免初始化结果覆盖用户刚做的修改
        await init().catch(() => undefined);

        const next = { ...store, ...patch } as T;
        setStore((prev) => ({ ...prev, ...patch }));
        await options.write(next, patch);
    };

    return { store, init, update };
}
