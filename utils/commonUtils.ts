import { isPageInPinnedHistory } from "@/utils/bili";

export const checkPageReady = async (
    isCol: boolean,
    isAutoHandle: boolean,
    url: string,
) => {
    return isCol && (isAutoHandle || (await isPageInPinnedHistory(url)));
};



export const checkPageCollection = async ()=>{
    
}