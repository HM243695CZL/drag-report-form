<template>
    <div ref="item" class="vue-grid-layout" :style="mergedStyle">
        <slot></slot>
        <grid-item
            class="vue-grid-placeholder"
            v-show="isDragging"
            :x="placeholder.x"
            :y="placeholder.y"
            :w="placeholder.w"
            :h="placeholder.h"
            :i="placeholder.i"
        ></grid-item>
    </div>
</template>

<script>
    import Vue from 'vue'
    var elementResizeDetectorMaker = require('element-resize-detector')
    import GridItem from './GridItem'
    import {getLayoutItem, validateLayout, compact, bottom, getAllCollision, cloneLayout, moveElement} from "../helpers/utils";
    import {getBreakpointFromWidth, getColsFromBreakpoint, findOrGenerateResponsiveLayout} from "../helpers/responsiveUtils";
    import {addWindowEventListener} from "../helpers/DOM";

    export default {
        name: "GridLayout",
        /** provide和inject
         * 这对选项需要一起使用，以允许一个祖先组件向其所有子孙后代注入一个依赖，不论组件层次有多深，
         * 并在起上下游关系成立的时间里始终生效。如果你熟悉 React，这与 React 的上下文特性很相似
         * 即：
         *  provide 可以在祖先组件中指定我们想要提供给后代组件的数据或方法，
         *  而在任何后代组件中，我们都可以使用 inject 来接收 provide 提供的数据或方法。
         * @return {{eventBus: null}}
         */
        provide(){
            return {
                eventBus: null
            }
        },
        props: {
            layout: {
                type: Array,
                required: true
            },
            colNum: {
                type: Number,
                default: 12
            },
            rowHeight: {
                type: Number,
                default: 150
            },
            isDraggable: {
                type: Boolean,
                default: true
            },
            isResizable: {
                type: Boolean,
                default: true
            },
            preventCollision: {
                type: Boolean,
                default: false
            },
            verticalCompact: {
                type: Boolean,
                default: true
            },
            useCssTransforms: {
                type: Boolean,
                default: true
            },
            responsive: {
                type: Boolean,
                default: false
            },
            autoSize: {
                type: Boolean,
                default: true
            },
            maxRows: {
                type: Number,
                default: Infinity
            },
            margin: {
                type: Array,
                default: () => {
                    return [10, 10]
                }
            },
            breakpoints: {
                type: Object,
                default: () => {
                    return {
                        lg: 1200,
                        md: 996,
                        sm: 768,
                        xs: 480,
                        xxs: 0
                    }
                }
            },
            cols: {
                type: Object,
                default: () => {
                    return {
                        lg: 100,
                        md: 10,
                        sm: 6,
                        xs: 4,
                        xxs: 2
                    }
                }
            }
        },
        data(){
            return {
                width: null,
                mergedStyle: {},
                lastLayoutLength: 0,
                isDragging: false,
                placeholder: {
                    x: 0,
                    y: 0,
                    w: 0,
                    h: 0,
                    i: -1
                },
                originalLayout: null, //保存原始数据
                lastBreakpoint: null, // 保存上一个激活断点
                layouts: {}, // 用来存储来自不同断点的所有数据
            }
        },
        components: {
            GridItem
        },
        created(){
            const self = this
            self.resizeEventHandle = function(eventType, i, x, y, h, w){
                self.resizeEvent(eventType, i, x, y, h, w)
            }
            self.dragEventHandle = function(eventType, i, x, y, h, w){
                self.dragEvent(eventType, i, x, y, h, w)
            }
            self._provided.eventBus = new Vue()
            self.eventBus = self._provided.eventBus
            // $on： 监听当前实例的自定义事件
            self.eventBus.$on('resizeEvent', self.resizeEventHandle)
            self.eventBus.$on('dragEvent', self.dragEventHandle)
            self.$emit('layout-created', self.layout)
        },
        beforeMount(){
            this.$emit('layout-before-mount', this.layout)
        },
        mounted(){
            this.$emit('layout-mounted', this.layout)
            this.$nextTick(() => {
                validateLayout(this.layout)
                this.originalLayout = this.layout
                const self = this
                this.$nextTick(() => {
                    self.onWindowResize()
                    self.initResponsiveFeatures()
                    addWindowEventListener('resize', self.onWindowResize)
                    compact(self.layout, self.verticalCompact)
                    self.updateHeight()
                    self.$nextTick(() => {
                        this.erd = elementResizeDetectorMaker({
                            strategy: 'scroll', // 超高性能
                            callOnAdd: false
                        })
                        // 监听元素的大小变化
                        this.erd.listenTo(self.$refs.item, function(){
                            self.onWindowResize()
                        })
                    })
                })
            })
        },
        watch: {
          width(newVal, oldVal){
            this.$nextTick(() => {
                this.eventBus.$emit('updateWidth', this.width)
                if(oldVal === null){
                    /**
                     * 如果oldVal === null 时，表示之前从未设置过宽度
                     * 那只会在挂载完成并且已经调用onWindowResize，
                     * this.width第一次改变之后在构造函数中设置为null
                     * 这是可以调用layout-ready的事件了，因为布局选项的大小已经正确配置
                     *
                     * 可以调用layout-ready是因为上面的updateWidth事件已调用并且对布局选项产生了影响
                     * 因此可以确定已经有了最终尺寸和已准备好布局
                     *
                     * 这样任何客户端事件的处理程序都可以可靠的研究布局选项的大小
                     */
                    this.$nextTick(() => {
                        this.$emit('layout-ready', self.layout)
                    })
                }
                this.updateHeight()
            })
          },
            layout(){
                this.layoutUpdate()
            }
        },
        methods: {
            layoutUpdate(){
                if(this.layout !== undefined && this.originalLayout !== null){
                    if(this.layout.length !== this.originalLayout.length){
                        let diff = this.findDifference(this.layout, this.originalLayout)
                        if(diff.length > 0){
                            if(this.layout.length > this.originalLayout.length){
                                this.originalLayout = this.originalLayout.concat(diff)
                            }else{
                                this.originalLayout = this.originalLayout.filter(item => {
                                    return !diff.some(ele => {
                                        return item.i === ele.i
                                    })
                                })
                            }
                        }
                        this.lastLayoutLength = this.layout.length
                        this.initResponsiveFeatures()
                    }
                    compact(this.layout, this.verticalCompact)
                    this.eventBus.$emit('updateWidth', this.width)
                    this.updateHeight()
                }
            },
            /**
             * 元素尺寸改变
             * @param eventName 事件名称
             * @param id
             * @param x
             * @param y
             * @param h
             * @param w
             */
            resizeEvent(eventName, id, x, y, h, w){
                let l = getLayoutItem(this.layout, id)
                // 当布局项返回空对象时
                if(l === undefined || l === null){
                    l = {
                        h: 0,
                        w: 0
                    }
                }
                let hasCollisions
                if(this.preventCollision){
                    const collisions = getAllCollision(this.layout, {...l, w, h}).filter(layoutItem => layoutItem.i !== l.i)
                    hasCollisions = collisions.length > 0
                    // 如果发生碰撞，需要调整占位元素
                    if(hasCollisions){
                        // 调整宽度和高度到允许的最大控件
                        let leastX = Infinity, leastY = Infinity
                        collisions.forEach(layoutItem => {
                            if(layoutItem.x > l.x) leastX = Math.min(leastX, layoutItem.x)
                            if(layoutItem.y > l.y) leastY = Math.max(leastY, layoutItem.y)
                        })
                        // Number.isFinite() 检测参数是否为无穷大
                        if(Number.isFinite(leastX)) l.w = leastX - l.w
                        if(Number.isFinite(leastY)) l.h = leastY - l.y
                    }
                }
                if(!hasCollisions){
                    // 设置新的宽度和高度
                    l.w = w
                    l.h = h
                }
                // 当尺寸开始改变和正在改变时，更新容器宽度
                if(eventName === 'resizestart' || eventName === 'resizemove'){
                    this.placeholder.i = id
                    this.placeholder.x = x
                    this.placeholder.y = y
                    this.placeholder.w = l.w
                    this.placeholder.h = l.h
                    this.$nextTick(() => {
                        this.isDragging = true
                    })
                    this.eventBus.$emit('updateWidth', this.width)
                } else{
                    this.$nextTick(() => {
                        this.isDragging = false
                    })
                }
                if(this.responsive) this.responsiveGridLayout()
                compact(this.layout, this.verticalCompact)
                this.eventBus.$emit('compact')
                this.updateHeight()
                if(eventName === 'resizeend') this.$emit('layout-updated', this.layout)
            },
            /**
             * 为了设置断点查找或生成新布局
             */
            responsiveGridLayout(){
                let newBreakpoint = getBreakpointFromWidth(this.breakpoints, this.width)
                let newCols = getColsFromBreakpoint(newBreakpoint, this.cols)
                // 在布局中保存实际布局
                if(this.lastBreakpoint !== null && !this.layouts[this.lastBreakpoint]){
                    this.layouts[this.lastBreakpoint] = cloneLayout(this.layout)
                }
                // 查找或生成新布局
                let layout = findOrGenerateResponsiveLayout(
                    this.originalLayout,
                    this.layouts,
                    this.breakpoints,
                    newBreakpoint,
                    this.lastBreakpoint,
                    newCols,
                    this.verticalCompact
                )
                // 保存新布局
                this.layouts[newBreakpoint] = layout
                // 同步布局
                this.$emit('update:layout', layout)
                this.lastBreakpoint = newBreakpoint
                this.eventBus.$emit('setColNum', getColsFromBreakpoint(newBreakpoint, this.cols))
            },
            /**
             * 在layouts找到差异
             */
            findDifference(layout, originalLayout){
                let uniqueResultOne = layout.filter(item => {
                    return !originalLayout.some(ele => {
                        return item.i === ele.i
                    })
                })
                let uniqueResultTwo = originalLayout.filter(item => {
                    return !layout.some(ele => {
                        return item.i === ele.i
                    })
                })
                return uniqueResultOne.concat(uniqueResultTwo)
            },
            /**
             * 拖拽元素
             * @param eventName 事件名称
             * @param id
             * @param x
             * @param y
             * @param h
             * @param w
             */
            dragEvent(eventName, id, x, y, h, w){
                let l = getLayoutItem(this.layout, id)
                // 布局选项有时会返回空对象
                if(l === undefined || l === null){
                    l = {
                        x: 0,
                        y: 0
                    }
                }
                if(eventName === 'dragmove' || eventName === 'dragstart'){
                    this.placeholder.i = id
                    this.placeholder.x = l.x
                    this.placeholder.y = l.y
                    this.placeholder.w = w
                    this.placeholder.h = h
                    this.$nextTick(() => {
                        this.isDragging = true
                    })
                    this.eventBus.$emit('updateWidth', this.width)
                }else {
                    this.$nextTick(() => {
                        this.isDragging = false
                    })
                }
                // 将元素移动到拖动的位置
                this.layout = moveElement(this.layout, l, x, y, true, this.preventCollision)
                compact(this.layout, this.verticalCompact)
                this.eventBus.$emit('compact')
                this.updateHeight()
                if(eventName === 'dragend') this.$emit('layout-updated', this.layout)
            },
            /**
             * 当页面尺寸改变
             */
            onWindowResize(){
                if(this.$refs !== null && this.$refs.item !== null && this.$refs.item !== undefined){
                    this.width = this.$refs.item.offsetWidth
                }
                this.eventBus.$emit('resizeEvent')
            },
            /**
             * 清除所有的响应式数据
             */
            initResponsiveFeatures(){
                this.layouts = {}
            },
            /**
             * 更新容器高度
             */
            updateHeight(){
                this.mergedStyle = {
                    height: this.containerHeight()
                }
            },
            /**
             * 计算容器高度 返回高度像素
             * @return {string}
             */
            containerHeight(){
                if(!this.autoSize) return
                return bottom(this.layout) * (this.rowHeight + this.margin[1]) + this.margin[1] + 'px'
            }
        }
    }
</script>

<style scoped lang="scss">
.vue-grid-layout{
    position: relative;
    transition: height 200ms ease;
    background-color: #eee;
    /*background-image: linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 0);*/
    /*background-size: 116px 116px;*/
}
</style>
