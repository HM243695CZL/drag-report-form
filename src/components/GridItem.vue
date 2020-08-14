<template>
    <div ref="item" class="vue-grid-item" :class="classObj" :style="style">
        <slot></slot>
        <span v-if="resizableAndNotStatic" ref="handle" :class="resizableHandleClass"></span>
        <span ref="closeHandle" class="el-icon-close closeHandle" @click="deleteItem"></span>
    </div>
</template>

<script>
    import {setTransform, setTransformRtl, setTopLeft, setTopRight} from "../helpers/utils";
    import {getControlPosition, createCoreData} from "../helpers/draggableUtils";

    let interact = require('interactjs')
    export default {
        name: "GridItem",
        props: {
            isDraggable: {
                type: Boolean,
                default: null
            },
            isResizable: {
                type: Boolean,
                default: null
            },
            static: {
                type: Boolean,
                default: false
            },
            x: {
                type: Number,
                required: true
            },
            y: {
                type: Number,
                required: true
            },
            w: {
                type: Number,
                required: true
            },
            h: {
                type: Number,
                required: true
            },
            i: {
                required: true
            },
            minH: {
                type: Number,
                default: 1
            },
            minW: {
                type: Number,
                default: 1
            },
            maxH: {
                type: Number,
                default: Infinity
            },
            maxW: {
                type: Number,
                default: Infinity
            },
            resizeIgnoreFrom: {
                type: String,
                default: 'a, button'
            },
            dragIgnoreFrom: {
                type: String,
                default: 'a, button'
            },
            dragAllowFrom: {
                type: String,
                default: null
            }
        },
        inject: ['eventBus'],
        data(){
            return {
                cols: 1,
                rowHeight: 30,
                containerWidth: 100,
                margin: [10, 10],
                maxRows: Infinity,
                draggable: null,
                resizable: null,
                isResizing: false,
                resizing: null,
                isDragging: false,
                lastX: NaN,
                lastY: NaN,
                lastW: NaN,
                LastH: NaN,
                dragging: null, // 用于保存开始拖动时元素的位置信息
                useCssTransforms: true,
                rtl: false,
                dragEventSet: false,
                resizeEventSet: false,
                style: {},
                innerX: this.x,
                innerY: this.y,
                innerW: this.w,
                innerH: this.h,
                previousW: null,
                previousH: null,
                previousX: null,
                previousY: null
            }
        },
        computed: {
            classObj(){
                return {
                    'vue-resizable': this.resizableAndNotStatic,
                    'static': this.static,
                    'resizing': this.isResizing,
                    'vue-draggable-dragging': this.isDragging,
                    'cssTransforms': this.useCssTransforms,
                    'render-rtl': this.renderRtl,
                    'disable-userselect': this.isDragging,
                    'no-touch': this.isAndroid && this.draggableOrResizableAndNotStatic
                }
            },
            resizableAndNotStatic(){
                return this.resizable && !this.static
            },
            draggableOrResizableAndNotStatic(){
                return (this.draggable || this.resizable) && !this.static
            },
            renderRtl(){
                return this.rtl
            },
            isAndroid(){
                return navigator.userAgent.toLowerCase().indexOf('android') !== -1
            },
            resizableHandleClass(){
                if(this.renderRtl){
                    return 'vue-resizable-handle vue-rtl-resizable-handle'
                }else{
                    return 'vue-resizable-handle'
                }
            }
        },
        created(){
            let self = this
            self.updateWidthHandler = (width) => {
                self.updateWidth(width)
            }
            self.compactHandler = () => {
                self.compact()
            }
            self.setColNum = (colNum) => {
                self.cols = parseInt(colNum)
            }
            this.eventBus.$on('updateWidth', self.updateWidthHandler)
            this.eventBus.$on('compact', self.compactHandler)
            this.eventBus.$on('setColNum', self.setColNum)

        },
        watch: {
            cols(){
                this.tryMakeResizable()
                this.createStyle()
                this.emitResized()
            },
            containerWidth(){
                this.tryMakeResizable()
                this.createStyle()
                this.emitResized()
            },
            static(){
                this.tryMakeDraggable()
                this.tryMakeResizable()
            },
            draggable(){
                this.tryMakeDraggable()
            },
            x(newVal){
                this.innerX = newVal
                this.createStyle()
            },
            y(newVal){
                this.innerY = newVal
                this.createStyle()
            },
            h(newVal){
                this.innerH = newVal
                this.createStyle()
                this.emitResized()
            },
            w(newVal){
                this.innerW = newVal
                this.createStyle()
                this.emitResized()
            }
        },
        mounted(){
            this.cols = this.$parent.colNum
            this.rowHeight = this.$parent.rowHeight
            this.containerWidth = this.$parent.width !== null ? this.$parent.width : 100
            this.margin = this.$parent.margin !== undefined ? this.$parent.margin : [10, 10]
            this.maxRows = this.$parent.maxRows
            this.draggable = this.isDraggable === null ? this.$parent.isDraggable : this.isDraggable
            this.resizable = this.isResizable === null ? this.$parent.isResizable : this.isResizable
            this.useCssTransforms = this.$parent.useCssTransforms
            this.createStyle()
        },
        methods: {
            /**
             * 创建选项样式
             */
            createStyle(){
                if(this.x + this.w > this.cols){
                    this.innerX = 0
                    this.innerW = (this.w > this.cols) ? this.cols : this.w
                } else {
                    this.innerX = this.x
                    this.innerW = this.w
                }
                let pos = this.calcPosition(this.innerX, this.innerY, this.innerW, this.innerH)
                if(this.isDragging){
                    pos.top = this.dragging.top
                    // 添加rtl支持
                    if(this.renderRtl){
                        pos.right = this.dragging.left
                    } else{
                        pos.left = this.dragging.left
                    }
                }
                if(this.isResizing){
                    pos.width = this.resizing.width
                    pos.height = this.resizing.height
                }
                let style
                // 支持CSS Transform (默认)
                if(this.useCssTransforms){
                    style = this.renderRtl ? setTransformRtl(pos.top, pos.right, pos.width, pos.height) : setTransform(pos.top, pos.left, pos.width, pos.height)
                } else{
                    style = this.renderRtl ? setTopRight(pos.top, pos.right, pos.width, pos.height) : setTopLeft(pos.top, pos.left, pos.width, pos.height)
                }
                this.style = style
            },
            emitResized(){
                let styleProps = {}
                for(let prop of ['width', 'height']){
                    let val = this.style[prop]
                    let matches = val.match(/^(\d+)px$/)
                    if(!matches) return
                    styleProps[prop] = matches[1]
                }
                this.$emit('resized', this.i, this.h, this.w, styleProps.height, styleProps.width)
            },
            /**
             * 改变元素尺寸
             */
            handleResize(event){
                if(this.static) return
                const position = getControlPosition(event)
                // 获取事件的当前拖动点作为偏移量
                if(position === null) return
                const {x, y} = position
                const newSize = {width: 0, height: 0}
                let pos
                switch (event.type) {
                    case 'resizestart': {
                        this.previousW = this.innerW
                        this.previousH = this.innerH
                        pos = this.calcPosition(this.innerX, this.innerY, this.innerW, this.innerH)
                        newSize.width = pos.width
                        newSize.height = pos.height
                        this.resizing = newSize
                        this.isResizing = true
                        break
                    }
                    case 'resizemove': {
                        const coreEvent = createCoreData(this.lastW, this.lastH, x, y)
                        newSize.width = this.renderRtl ? this.resizing.width - coreEvent.deltaX : this.resizing.width + coreEvent.deltaX
                        newSize.height = this.resizing.height + coreEvent.deltaY
                        this.resizing = newSize
                        break
                    }
                    case 'resizeend': {
                        pos = this.calcPosition(this.innerX, this.innerY, this.innerW, this.innerH)
                        newSize.width = pos.width
                        newSize.height = pos.height
                        this.resizing = null
                        this.isResizing = false
                        break
                    }
                }
                // 获取新的宽度和高度
                pos = this.calcWH(newSize.height, newSize.width)
                if(pos.w < this.minW) pos.w = this.minW
                if(pos.w > this.maxW) pos.w = this.maxW
                if(pos.h < this.minH) pos.h = this.minH
                if(pos.h > this.maxH) pos.h = this.maxH
                if(pos.h < 1) pos.h = 1
                if(pos.w < 1) pos.w = 1
                this.lastW = x
                this.lastH = y
                if(this.innerW !== pos.w || this.innerH !== pos.h){
                    this.$emit('resize', this.i, pos.h, pos.w, newSize.height, newSize.width)
                }
                if(event.type === 'resizeend' && (this.previousW !== this.innerW) || this.previousH !== this.innerH){
                    this.$emit('resized', this.i, pos.h, pos.w, newSize.height, newSize.width)
                }
                this.eventBus.$emit('resizeEvent', event.type, this.i, this.innerX, this.innerY, pos.h, pos.w)
            },
            /**
             * 拖动元素
             */
            handleDrag(event){
                if(this.static) return
                if(this.isResizing) return
                const position = getControlPosition(event)
                // 获取事件的当前拖动点用作偏移量
                if(position === null) return
                const {x, y} = position
                let newPosition = {top: 0, left: 0}
                switch (event.type) {
                    case 'dragstart': {
                        this.previousX = this.innerX
                        this.previousY = this.innerY
                        // 获取父元素的位置集合
                        let parentRect = event.target.offsetParent.getBoundingClientRect()
                        let clientRect = event.target.getBoundingClientRect()
                        if(this.renderRtl){
                            newPosition.left = (clientRect.right - parentRect.right) * -1
                        } else {
                            newPosition.left = clientRect.left - parentRect.left
                        }
                        newPosition.top = clientRect.top - parentRect.top
                        this.dragging = newPosition
                        this.isDragging = true
                        break
                    }
                    case 'dragend': {
                        if(!this.isDragging) return
                        let parentRect = event.target.offsetParent.getBoundingClientRect()
                        let clientRect = event.target.getBoundingClientRect()
                        newPosition.left = this.renderRtl ? (clientRect.right - parentRect.right) * -1 : clientRect.left - parentRect.left
                        newPosition.top = clientRect.top - parentRect.top
                        this.dragging = null
                        this.isDragging = false
                        break
                    }
                    case 'dragmove': {
                        const coreEvent = createCoreData(this.lastX, this.lastY, x, y)
                        newPosition.left = this.renderRtl ? this.dragging.left - coreEvent.deltaX : this.dragging.left + coreEvent.deltaX
                        newPosition.top = this.dragging.top + coreEvent.deltaY
                        this.dragging = newPosition
                        break
                    }
                }
                // 获取新的XY
                let pos
                pos = this.calcXY(newPosition.top, newPosition.left)
                this.lastX = x
                this.lastY = y
                if(this.innerX !== pos.x || this.innerY !== pos.y){
                    this.$emit('move', this.i, pos.x, pos.y)
                }
                if(event.type === 'dragend' &&(this.previousX !== this.innerX || this.previousY !== this.innerY)){
                    this.$emit('moved', this.i, pos.x, pos.y)
                }
                this.eventBus.$emit('dragEvent', event.type, this.i, pos.x, pos.y, this.innerH, this.innerW)
            },
            /**
             * 将x和y的坐标从像素转换为网格单位
             * @param {Number} top 相对于父元素的top，单位为px
             * @param {Number} left 相对于父元素的left， 单位为px
             * @return{Object} 以网格为单位的x和y
             */
            calcXY(top, left){
                const colWidth = this.calcColWidth()
                let x = Math.round((left - this.margin[0]) / (colWidth + this.margin[0]))
                let y = Math.round((top - this.margin[1]) / (this.rowHeight + this.margin[1]))
                x = Math.max(Math.min(x, this.cols - this.innerW), 0)
                y = Math.max(Math.min(y, this.maxRows - this.innerH), 0)
                return {x, y}
            },
            /**
             * 将宽度和高度转换为网格单位
             * @param {Number} height 高度， 单位为px
             * @param {Number} width 宽度， 单位为px
             * @return {Object} 以网格为单位的w和h
             */
            calcWH(height, width){
                const colWidth = this.calcColWidth()
                let w = Math.ceil((width + this.margin[0]) / (colWidth + this.margin[0]))
                let h = Math.ceil((height + this.margin[1]) / (this.rowHeight + this.margin[1]))
                w = Math.max(Math.min(w, this.cols - this.innerX), 0)
                h = Math.max(Math.min(h, this.maxRows - this.innerY), 0)
                return {w, h}
            },
            /**
             * 计算选项位置 根据参数计算具体的样式数值
             * @param x
             * @param y
             * @param w
             * @param h
             */
            calcPosition(x, y, w, h){
                const colWidth = this.calcColWidth()
                // 添加rtl支持
                let out
                if(this.renderRtl){
                    out = {
                        right: Math.round(colWidth * x + (x + 1) * this.margin[0]),
                        top: Math.round(this.rowHeight * y + (y + 1) * this.margin[1]),
                        width: w === Infinity ? w : Math.round(colWidth * w + Math.max(0, w - 1) * this.margin[0]),
                        height: h === Infinity ? h : Math.round(this.rowHeight * h + Math.max(0, h - 1) * this.margin[1])
                    }
                }else {
                    out = {
                        left: Math.round(colWidth * x + (x + 1) * this.margin[0]),
                        top: Math.round(this.rowHeight * y + (y + 1) * this.margin[1]),
                        width: w === Infinity ? w : Math.round(colWidth * w + Math.max(0, w - 1) * this.margin[0]),
                        height: h === Infinity ? h : Math.round(this.rowHeight * h + Math.max(0, h - 1) * this.margin[1])
                    }
                }
                return out
            },
            /**
             * 计算列宽
             */
            calcColWidth(){
                return (this.containerWidth - (this.margin[0] * (this.cols + 1))) / this.cols
            },
            updateWidth(width){
                this.containerWidth = width
            },
            compact(){
                this.createStyle()
            },
            tryMakeResizable(){
                const self = this
                if(this.interactObj === null || this.interactObj === undefined){
                    this.interactObj = interact(this.$refs.item)
                }
                if(this.resizable && !this.static){
                    let max = this.calcPosition(0, 0, this.maxW, this.maxH)
                    let min = this.calcPosition(0, 0, this.minW, this.minH)
                    const opts = {
                        preserveAspectRatio: true, // 保留纵横比
                        edges: { // 正在修改的元素的边
                            left: false, // 禁止从左边缘调整大小
                            right: '.' + this.resizableHandleClass, // 如果鼠标目标与选择器匹配， 则调整大小
                            bottom: '.' + this.resizableHandleClass,
                            top: false // 禁止从上边缘调整大小
                        },
                        ignoreForm: this.resizeIgnoreFrom,
                        restrictSize: { // 限制大小
                            min: {
                                height: min.height,
                                width: min.width
                            },
                            max: {
                                height: max.height,
                                width: max.width
                            }
                        }
                    }
                    this.interactObj.resizable(opts)
                    if(!this.resizeEventSet){
                        this.resizeEventSet = true
                        this.interactObj
                            .on('resizestart resizemove resizeend', function(event) {
                                self.handleResize(event)
                            })
                    }
                } else {
                    this.interactObj.resizable({
                        enabled: false
                    })
                }
            },
            tryMakeDraggable(){
                const self = this
                if(this.interactObj === null || this.interactObj === undefined){
                    this.interactObj = interact(this.$refs.item)
                }
                if(this.draggable && !this.static){
                    const opts = {
                        ignoreFrom: this.dragIgnoreFrom,
                        allowFrom: this.dragAllowFrom
                    }
                    this.interactObj.draggable(opts)
                    if(!this.dragEventSet){
                        this.dragEventSet = true
                        this.interactObj.on('dragstart dragmove dragend', function(event){
                            self.handleDrag(event)
                        })
                    }
                } else {
                    this.interactObj.draggable({
                        enabled: false
                    })
                }
            },
            deleteItem(){
                this.$emit('delete-grid-item', this.i)
            }
        }
    }
</script>

<style scoped lang="scss">
    .vue-grid-item {
        transition: all 200ms ease;
        transition-property: left, top, right;
        cursor: default !important;
        &.no-touch {
            -ms-touch-action: none;
            touch-action: none;
        }

        &.cssTransforms {
            transition-property: transform;
            left: 0;
            right: auto;

            &.render-rtl {
                left: auto;
                right: 0;
            }
        }

        &.resizing {
            opacity: 0.6;
            z-index: 3;
        }

        &.vue-draggable-dragging {
            transition: none;
            z-index: 3;
        }

        &.vue-grid-placeholder {
            background: red;
            opacity: 0.2;
            transition-duration: 100ms;
            z-index: 2;
            -webkit-user-select: none;
            -moz-user-select: none;
            -ms-user-select: none;
            -o-user-select: none;
            user-select: none;
        }

        & > .vue-resizable-handle {
            position: absolute;
            width: 20px;
            height: 20px;
            bottom: 0;
            right: 0;
            background: url('data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBzdGFuZGFsb25lPSJubyI/Pg08IS0tIEdlbmVyYXRvcjogQWRvYmUgRmlyZXdvcmtzIENTNiwgRXhwb3J0IFNWRyBFeHRlbnNpb24gYnkgQWFyb24gQmVhbGwgKGh0dHA6Ly9maXJld29ya3MuYWJlYWxsLmNvbSkgLiBWZXJzaW9uOiAwLjYuMSAgLS0+DTwhRE9DVFlQRSBzdmcgUFVCTElDICItLy9XM0MvL0RURCBTVkcgMS4xLy9FTiIgImh0dHA6Ly93d3cudzMub3JnL0dyYXBoaWNzL1NWRy8xLjEvRFREL3N2ZzExLmR0ZCI+DTxzdmcgaWQ9IlVudGl0bGVkLVBhZ2UlMjAxIiB2aWV3Qm94PSIwIDAgNiA2IiBzdHlsZT0iYmFja2dyb3VuZC1jb2xvcjojZmZmZmZmMDAiIHZlcnNpb249IjEuMSINCXhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgeG1sbnM6eGxpbms9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkveGxpbmsiIHhtbDpzcGFjZT0icHJlc2VydmUiDQl4PSIwcHgiIHk9IjBweCIgd2lkdGg9IjZweCIgaGVpZ2h0PSI2cHgiDT4NCTxnIG9wYWNpdHk9IjAuMzAyIj4NCQk8cGF0aCBkPSJNIDYgNiBMIDAgNiBMIDAgNC4yIEwgNCA0LjIgTCA0LjIgNC4yIEwgNC4yIDAgTCA2IDAgTCA2IDYgTCA2IDYgWiIgZmlsbD0iIzAwMDAwMCIvPg0JPC9nPg08L3N2Zz4=');
            background-position: bottom right;
            padding: 0 3px 3px 0;
            background-repeat: no-repeat;
            background-origin: content-box;
            box-sizing: border-box;
            cursor: se-resize;
        }
        & .closeHandle{
            position: absolute;
            right: 0;
            top: 0;
            cursor: pointer;
            display: none;
        }
        &:hover{
            .closeHandle{
                display: block;
            }
        }
        & > .vue-rtl-resizable-handle {
            bottom: 0;
            left: 0;
            background: url(data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAuMDAwMDAwMDAwMDAwMDAyIiBoZWlnaHQ9IjEwLjAwMDAwMDAwMDAwMDAwMiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KIDwhLS0gQ3JlYXRlZCB3aXRoIE1ldGhvZCBEcmF3IC0gaHR0cDovL2dpdGh1Yi5jb20vZHVvcGl4ZWwvTWV0aG9kLURyYXcvIC0tPgogPGc+CiAgPHRpdGxlPmJhY2tncm91bmQ8L3RpdGxlPgogIDxyZWN0IGZpbGw9Im5vbmUiIGlkPSJjYW52YXNfYmFja2dyb3VuZCIgaGVpZ2h0PSIxMiIgd2lkdGg9IjEyIiB5PSItMSIgeD0iLTEiLz4KICA8ZyBkaXNwbGF5PSJub25lIiBvdmVyZmxvdz0idmlzaWJsZSIgeT0iMCIgeD0iMCIgaGVpZ2h0PSIxMDAlIiB3aWR0aD0iMTAwJSIgaWQ9ImNhbnZhc0dyaWQiPgogICA8cmVjdCBmaWxsPSJ1cmwoI2dyaWRwYXR0ZXJuKSIgc3Ryb2tlLXdpZHRoPSIwIiB5PSIwIiB4PSIwIiBoZWlnaHQ9IjEwMCUiIHdpZHRoPSIxMDAlIi8+CiAgPC9nPgogPC9nPgogPGc+CiAgPHRpdGxlPkxheWVyIDE8L3RpdGxlPgogIDxsaW5lIGNhbnZhcz0iI2ZmZmZmZiIgY2FudmFzLW9wYWNpdHk9IjEiIHN0cm9rZS1saW5lY2FwPSJ1bmRlZmluZWQiIHN0cm9rZS1saW5lam9pbj0idW5kZWZpbmVkIiBpZD0ic3ZnXzEiIHkyPSItNzAuMTc4NDA3IiB4Mj0iMTI0LjQ2NDE3NSIgeTE9Ii0zOC4zOTI3MzciIHgxPSIxNDQuODIxMjg5IiBzdHJva2Utd2lkdGg9IjEuNSIgc3Ryb2tlPSIjMDAwIiBmaWxsPSJub25lIi8+CiAgPGxpbmUgc3Ryb2tlPSIjNjY2NjY2IiBzdHJva2UtbGluZWNhcD0idW5kZWZpbmVkIiBzdHJva2UtbGluZWpvaW49InVuZGVmaW5lZCIgaWQ9InN2Z181IiB5Mj0iOS4xMDY5NTciIHgyPSIwLjk0NzI0NyIgeTE9Ii0wLjAxODEyOCIgeDE9IjAuOTQ3MjQ3IiBzdHJva2Utd2lkdGg9IjIiIGZpbGw9Im5vbmUiLz4KICA8bGluZSBzdHJva2UtbGluZWNhcD0idW5kZWZpbmVkIiBzdHJva2UtbGluZWpvaW49InVuZGVmaW5lZCIgaWQ9InN2Z183IiB5Mj0iOSIgeDI9IjEwLjA3MzUyOSIgeTE9IjkiIHgxPSItMC42NTU2NCIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2U9IiM2NjY2NjYiIGZpbGw9Im5vbmUiLz4KIDwvZz4KPC9zdmc+);
            background-position: bottom left;
            padding-left: 3px;
            background-repeat: no-repeat;
            background-origin: content-box;
            cursor: sw-resize;
            right: auto;
        }

        &.disable-userselect {
            user-select: none;
        }
    }

</style>
