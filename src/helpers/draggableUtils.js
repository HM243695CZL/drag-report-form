/**
 * 获取事件的 {x, y}坐标
 * @param e 事件
 */
export function getControlPosition(e){
    return offsetXYFromParentOf(e)
}

/**
 * 从offsetParent获取
 * @param e 事件
 */
export function offsetXYFromParentOf(e){
    const offsetParent = e.target.offsetParent || document.body
    // ele.getBoundingClientRect() 返回元素的大小及其相对于视口的位置
    const offsetParentRect = e.offsetParent === document.body ? {left: 0, top: 0} : offsetParent.getBoundingClientRect()
    const x = e.clientX + offsetParent.scrollLeft - offsetParentRect.left
    const y = e.clientY + offsetParent.scrollTop - offsetParentRect.top
    return {x, y}
}

/**
 * 创建一个有<DraggableCore>事件公开的数据对象
 * @param lastX
 * @param lastY
 * @param x
 * @param y
 */
export function createCoreData(lastX, lastY, x, y) {
    // 状态更新通常是异步的， 需要最新的值
    const isStart = !isNum(lastX)
    if(isStart){
        // 如果这是第一步，使用x和y作为最后的坐标
        return {
            deltaX: 0, // 增量
            deltaY: 0,
            lastX: x,
            lastY: y,
            x,
            y
        }
    } else {
        // 否则，计算适当的值
        return {
            deltaX: x - lastX,
            deltaY: y - lastY,
            lastX,
            lastY,
            x,
            y
        }
    }
}

function isNum(num){
    return typeof num === 'number' && !isNaN(num)
}
