// @flow
import type {Layout} from "./utils";
import {cloneLayout, compact, correctBounds} from "./utils";
export type ResponsiveLayout = {lg?: Layout, md?: Layout, ms?: Layout, xs?: Layout, xxs?: Layout}
type Breakpoint = string
type Breakpoints = {lg?: number, md?: number, sm?: number, xs?: number, xxs?: number}


/**
 * 给定一个宽度，找到 width > breakpoint 有效匹配项的最高断点
 * @param {Object} breakpoints 断点对象， 如：{lg: 1200, md: 996, ...}
 * @param {Number} width 屏幕宽度
 * @return{string} 返回小于宽度的最高断点
 */
export function getBreakpointFromWidth(breakpoints: Breakpoints, width: number): Breakpoint{
    const sorted = sortBreakpoints(breakpoints)
    let matching = sorted[0]
    sorted.map(item => {
        if(width > breakpoints[item]) matching = item
    })
    return matching
}

/**
 * 给定一个断点，为其设置cols的值
 * @param breakpoint 断点名称
 * @param cols 断点到cols的映射
 */
export function getColsFromBreakpoint(breakpoint: Breakpoint, cols: Breakpoints): number{
    if(!cols[breakpoint]){
        throw new Error('ResponsiveGridLayout: `cols` 找不到断点入口：' + breakpoint)
    }
    return cols[breakpoint]
}

/**
 * 给定现有布局和新断点，查找或生成新布局，如果存在，将在新布局之上找到布局并从中生成布局
 * @param {Array} orgLayout 原来的布局
 * @param {Object} layouts 现有布局
 * @param {Array} breakpoints 所有断点
 * @param {String} breakpoint 新断点
 * @param lastBreakpoint 最后一个断点(用于后备)
 * @param cols 新断点的列数
 * @param verticalCompact 是否垂直压缩布局
 */
export function findOrGenerateResponsiveLayout(orgLayout: Layout, layouts: ResponsiveLayout, breakpoints: Breakpoints,
                                               breakpoint: Breakpoint, lastBreakpoint: Breakpoint,
                                               cols: number, verticalCompact: boolean): Layout{
    // 如果存在，则返回
    if(layouts[breakpoint]) return cloneLayout(layouts[breakpoint])
    // 查找或生成下一个布局
    let layout = orgLayout
    const breakpointsSorted = sortBreakpoints(breakpoints)
    const breakpointsAbove = breakpointsSorted.slice(breakpointsSorted.indexOf(breakpoint))
   for (let i = 0; i < breakpointsAbove.length; i++){
        const item = breakpointsAbove[i]
       if(layouts[item]){
            layout = layouts[item]
           break
       }
   }
    layout = cloneLayout(layout || []) // 复制布局，不需要修改现有项目
    return compact(correctBounds(layout, {cols}), verticalCompact)
}
/**
 * 给定断点，返回按宽度排序的断点数组， 如：['xxs', 'xs', 'sm', ...]
 * @param breakpoints 将断点名称的键值对设置为宽度
 * @return 返回已排序的断点
 */
export function sortBreakpoints(breakpoints: Breakpoints): Array<Breakpoint>{
    const keys: Array<string> = Object.keys(breakpoints)
    return keys.sort((a, b) => {
        return breakpoints[a] - breakpoints[b]
    })
}
