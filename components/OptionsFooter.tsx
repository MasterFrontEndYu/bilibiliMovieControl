import { getSoftVersion } from "@/utils/bili";



export const OptionsFooter = () => {
    return (
        <footer class="flex flex-wrap items-center justify-center w-full text-xs text-base-content/50">
            <p class="pt-2.5 h-auto">版本：{getSoftVersion()}</p>
            <div class="flex items-center justify-center w-full text-xs text-base-content/50 gap-1">

                <p class="m-0">© 2026</p>
                <a
                    href="https://github.com/sanguogege/BilibiliMovieControl"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="link link-primary no-underline"
                >
                    BilibiliMovieControl
                </a>
                <p class="m-0">仅供学习与交流使用。</p>
            </div>
        </footer>
    )
}