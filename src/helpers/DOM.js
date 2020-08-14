/**
 * 是否有window
 * @return {boolean}
 */
function hasWindow(){
    return (typeof window !== 'undefined')
}

/**
 * 添加事件监听
 * @param {Array} event
 * @param callback
 */
export function addWindowEventListener(event: string, callback: () => mixed){
    if(!hasWindow){
        callback()
        return;
    }
    window.addEventListener(event, callback)
}
