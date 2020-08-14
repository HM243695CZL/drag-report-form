// js类型检查 注释之后的内容才能被flow检测
// @flow
export type LayoutItemRequired = {w: number, h: number, x: number, y: number, i: string};
export type LayoutItem = LayoutItemRequired &
                        {minW?: number, minH?: number, maxW?: number, maxH?: number,
                            moved?: boolean, static?: boolean,
                            isDraggable?: ?boolean, isResizable?: ?boolean
                        }
export type Layout = Array<LayoutItem>

/**
 * 返回布局的底部坐标
 * @param layout 布局数组
 */
export function bottom(layout: Layout): number{
    let max = 0, bottomY
    layout.map(item => {
        bottomY = item.y + item.h
        if(bottomY > max){
            max = bottomY
        }
    })
    return max
}

/**
 * 复制布局数据
 * @param layout 布局数据
 */
export function cloneLayout(layout: Layout): Layout{
    const newLayout = Array(layout.length)
    layout.map((item, index) => {
        newLayout[index] = cloneLayoutItem(item)
    })
    return newLayout
}

/**
 * 快速复制
 * @param layoutItem 布局项
 */
export function cloneLayoutItem(layoutItem: LayoutItem): LayoutItem{
    return JSON.parse(JSON.stringify(layoutItem))
}

/**
 * 获取选中的选项
 * @param {Array} layout 布局数组
 * @param {String} id 需要获取的选项的id
 * @return {LayoutItem} 符合的选项
 */
export function getLayoutItem(layout: Layout, id: string): ?LayoutItem {
    let obj
    layout.forEach((item, index) => {
        if(item.i === id) obj = item
    })
    return obj
}

/**
 * 给定布局， 确保所有元素都适合其范围
 * @param {Array} layout 布局数组
 * @param {Number} bounds 列数
 */
export function correctBounds(layout: Layout, bounds: {cols: number}): Layout{
    const collidesWidth = getStatics(layout)
    layout.map(item => {
        // 超出右侧，则贴着右侧
        if(item.x + item.w > bounds.cols) item.x = bounds.cols - item.w
        // 超出左侧
        if(item.x < 0){
            item.x = 0
            item.w = bounds.cols
        }
        if(!item.static) collidesWidth.push(item)
        else{
            // 如果这是静态的并且与其他静态冲突，那么我们必须将其向下移动
            while (getFirstCollision(collidesWidth, item)){
                item.y ++
            }
        }
    })
    return layout
}

/**
 * 获取两个布局项，检查它们是否相撞
 * @param l1
 * @param l2
 * @return {boolean} 碰撞时为真
 */
export function collides(l1: LayoutItem, l2: LayoutItem): boolean{
    if(l1 === l2) return false //相同的元素
    if(l1.x + l1.w <= l2.x) return false // l1在l2的左边
    if(l1.x >= l2.x + l2.w) return false // l1在l2的右边
    if(l1.y + l1.h <= l2.y) return false // l1在l2的上面
    if(l1.y >= l2.h + l2.y) return false // l1在l2的下面
    return true // 元素重叠
}

/**
 * 返回布局冲突的第一个项目
 * @param {Array} layout 布局数组
 * @param layoutItem 布局项
 */
export function getFirstCollision(layout: Layout, layoutItem: LayoutItem): ?LayoutItem{
    // layout.map(item => {
    //     if(collides(item, layoutItem)) return item
    // })
    for (let i = 0, len = layout.length; i < len; i++) {
        if (collides(layout[i], layoutItem)) return layout[i];
    }
}

/**
 * 获取布局冲突的所有项
 * @param layout 布局数组
 * @param layoutItem 布局项
 */
export function getAllCollision(layout: Layout, layoutItem: LayoutItem): Array<LayoutItem>{
    return layout.filter(item => collides(item, layoutItem))
}

/**
 * 移动元素，负责其他元素的级联运动
 * @param {Array} layout 布局数组 要修改的完整布局
 * @param {LayoutItem} l 要移动的元素
 * @param {Number} x 以栅格单位表示的x位置
 * @param {Number} y 以栅格单位表示的y位置
 * @param {Boolean} isUserAction 如果为真，则表示用户正在拖动/调整要移动的元素的大小
 * @param {Boolean} preventCollision 是否防止碰撞
 */
export function moveElement(layout: Layout, l: LayoutItem, x: Number, y: Number, isUserAction: Boolean, preventCollision: Boolean): Layout{
    if(l.static) return layout
    const oldX = l.x
    const oldY = l.y
    const movingUp = y && l.y > y
    // 这比扩展对象要快很多
    if(typeof x === 'number') l.x = x
    if(typeof y === 'number') l.y = y
    l.moved = true
    /**
     * 如果发生碰撞，则移动
     * 在进行比较时，需要对要比较的选项进行排序，以确保在发生多次碰撞的情况下，能过获得最近的碰撞
     */
    let sorted = sortLayoutItemsByRowCol(layout)
    if(movingUp) sorted = sorted.reverse()
    const collisions = getAllCollision(sorted, l)
    if(preventCollision &&collisions.length){
        l.x = oldX
        l.y = oldY
        l.moved = false
        return layout
    }

    // 将碰撞的每个元素移离此元素
    for (let i = 0, len = collisions.length; i < len; i++){
        const item = collisions[i]
        if(item.moved) continue
        // 向上移动时，只需稍等一下即可使它感觉更加精确
        if(l.y > item.y && l.y - item.y > item.h / 4) continue
        // 不需要移动静态选项
        if(item.static){
            layout = moveElementAwayFromCollision(layout, item, l, isUserAction)
        }else{
            layout = moveElementAwayFromCollision(layout, l, item, isUserAction)
        }
    }
    return layout
}

/**
 * 在发生碰撞的情况下，将元素移离碰撞，如果有控件，尝试将其向上移动，否则向下移动
 * @param {Array} layout 要修改的完整布局
 * @param {LayoutItem} collidesWith 正在碰撞的布局项
 * @param {LayoutItem} itemToMove 移动的布局项
 * @param {Boolean} isUserAction 如果为真，则表示用户正在拖动/调整要移动的元素的大小
 */
export function moveElementAwayFromCollision(layout: Layout, collidesWith: LayoutItem, itemToMove: LayoutItem, isUserAction: ?boolean): Layout {
    const preventCollision = false
    /**
     * 如果碰撞上方有足够的空间来放置此元素，请将其移动到此处。我们仅在主碰撞上执行此操作，因为它可能会级联化并引起不必要的交换行为
     */
    if(isUserAction){
        // 制作一个模拟项目，以便在这里不修改该项目，仅在moveElement中进行修改
        const fakeItem: LayoutItem = {
            x: itemToMove.x,
            y: itemToMove.y,
            w: itemToMove.w,
            h: itemToMove.h,
            i: '-1'
        }
        fakeItem.y = Math.max(collidesWith.y - itemToMove.h, 0)
        if(!getFirstCollision(layout, fakeItem)){
            return moveElement(layout, itemToMove, undefined, fakeItem.y, preventCollision)
        }
    }
    return moveElement(layout, itemToMove, undefined, itemToMove.y + 1, preventCollision)
}

/**
 * 设置css转换
 * @param top
 * @param right
 * @param width
 * @param height
 */
export function setTransformRtl(top, right, width, height): Object {
    const translate = 'translate3d(' + right * -1 + 'px, ' + top + 'px, 0)'
    return {
        transform: translate,
        WebkitTransform: translate,
        MozTransform: translate,
        msTransform: translate,
        OTransform: translate,
        width: width + 'px',
        height: height + 'px',
        position: 'absolute'
    }
}

/**
 * 设置css转换
 * @param top
 * @param left
 * @param width
 * @param height
 */
export function setTransform(top, left, width, height): Object{
    const translate = 'translate3d(' + left + 'px, ' + top + 'px, 0)'
    return {
        transform: translate,
        WebkitTransform: translate,
        MozTransform: translate,
        msTransform: translate,
        OTransform: translate,
        width: width + 'px',
        height: height + 'px',
        position: 'absolute'
    }
}

/**
 * 设置上左的样式
 * @param top
 * @param left
 * @param width
 * @param height
 */
export function setTopLeft(top, left, width, height): Object {
    return {
        top: top + 'px',
        left: left + 'px',
        width: width + 'px',
        height: height + 'px',
        position: 'absolute'
    }
}

/**
 * 设置上右的样式
 * @param top
 * @param right
 * @param width
 * @param height
 */
export function setTopRight(top, right, width, height): Object {
    return {
        top: top + 'px',
        right: right + 'px',
        width: width + 'px',
        height: height + 'px',
        position: 'absolute'
    }
}

/**
 * 获取从左上到右和下排序的布局项
 * @param layout 先对静态项进行排序
 */
export function sortLayoutItemsByRowCol(layout: Layout): Layout{
    return [].concat(layout).sort(function(a, b){
        if(a.y > b.y || (a.y === b.y && a.x > b.x)){
            return 1
        }
        return -1
    })
}

/**
 * 获取所有的静态项元素
 * @param {Array} layout 布局数组
 * @return {LayoutItem} 过滤后的选项数组
 */
export function getStatics(layout: Layout): Array<LayoutItem>{
    return layout.filter(l => l.static)
}

/**
 * 验证数据，抛出错误
 * @param {Array} layout 布局数组
 * @param {String} contextName 错误的上下文名称
 */
export function validateLayout(layout: Layout, contextName: string): void {
    contextName = contextName || 'Layout'
    const subProps = ['x', 'y', 'w', 'h']
    if(!Array.isArray(layout)) throw new Error(contextName + '必须是array!')
    layout.map((item, index) => {
        subProps.map((ele, i) => {
            if(typeof item[subProps[i]] !== 'number'){
                throw new Error('GridLayout: ' + contextName + '[' + index + '].' + subProps[i] + '必须是number!')
            }
        })
        if(item.static !== undefined && typeof item.static !== 'boolean'){
            throw new Error('GridLayout: ' + contextName + '[' + index + '].static 必须是 boolean!')
        }
    })
}

/**
 * 压缩布局项目
 * @param compareWith static为true的布局项
 * @param row static为不为true的布局向
 * @param verticalCompact 是否垂直压缩布局
 */
export function compactItem(compareWith: Layout, row: LayoutItem, verticalCompact: boolean): LayoutItem{
    if(verticalCompact){
        // 在不发生碰撞的情况下尽可能向上移动元素
        while (row.y > 0 && !getFirstCollision(compareWith, row)) {
            row.y --
        }
    }
    // 向下移动，如果发生碰撞，继续向下移动
    let collides
    while ((collides = getFirstCollision(compareWith, row))) {
        row.y = collides.y + collides.h
    }
    return row
}

/**
 * 给定一个布局， 并压缩，需要向下移动每个y坐标并消除项目之间的间隙
 * @param {Array} layout 布局数组
 * @param {Boolean} verticalCompact 是否垂直压缩布局
 */
export function compact(layout: Layout, verticalCompact: Boolean): Layout{
    // statics会进入compareWith数组并环绕流动
    const compareWith = getStatics(layout)
    // 按行和列检查这些选项
    const sorted = sortLayoutItemsByRowCol(layout)
    const out = Array(layout.length)
    sorted.map(item => {
        let row = item
        // 不能移动静态元素
        if(!item.static){
            row = compactItem(compareWith, row, verticalCompact)
            // 添加到compareWith数组
            compareWith.push(row)
        }
        // 添加到out数组以确保它们仍然以正确的顺序出现
        out[layout.indexOf(row)] = row
        // 清除移动标志
        row.moved = false
    })
    return out
}
