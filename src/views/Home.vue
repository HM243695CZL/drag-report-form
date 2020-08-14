<template>
    <div class="home-container">
        <el-row>
            页面组件: [ x, y, w, h ]
            <div class="comp">
                <div class="layout-item" v-for="(item, index) in layout" :key="item.i">
                    <span class="title">{{item.i}}</span>
                    <div class="item"> -> [ {{item.x}}, {{item.y}}, {{item.w}}, {{item.h}} ]</div>
                </div>
            </div>
        </el-row>
        <el-row class="h-w-container">
            <div class="set-h-w">
                设置容器宽高：
                <div class="h-w">
                    rowHeight: <el-input v-model="rowHeight" size="mini" type="number"></el-input>
                </div>
                <div class="h-w">
                    colNum: <el-input v-model="colNum" size="mini" type="number"></el-input>
                </div>
            </div>
            <el-checkbox v-model="draggable">可拖动</el-checkbox>
            <el-checkbox v-model="resizable">可调整大小</el-checkbox>
            <el-checkbox v-model="responsive">响应式</el-checkbox>
            <el-checkbox v-model="preventCollision">防止碰撞</el-checkbox>
        </el-row>
        <el-row>
            <div class="operate-btn">
                <el-button @click="addItem">添加组件</el-button>
            </div>
        </el-row>
        <grid-layout
            :layout.sync="layout"
            :col-num="parseInt(colNum)"
            :row-height="parseInt(rowHeight)"
            :is-draggable="draggable"
            :is-resizable="resizable"
            :prevent-collision="preventCollision"
            :vertical-compact="true"
            :use-css-transforms="true"
            :responsive="responsive"
            @layout-created="layoutCreatedEvent"
            @layout-before-mount="layoutBeforeMountEvent"
            @layout-mounted="layoutMountedEvent"
            @layout-ready="layoutReadyEvent"
            @layout-updated="layoutUpdatedEvent"
        >
            <grid-item
                v-for="item in layout"
                :key="item.i"
                :static="item.static"
                :x="item.x"
                :y="item.y"
                :w="item.w"
                :h="item.h"
                :i="item.i"
                @resize="resize"
                @move="move"
                @resized="resized"
                @moved="moved"
                @delete-grid-item="deleteGridItem"
            >
                <view-element :text="item.i"></view-element>
            </grid-item>
        </grid-layout>
    </div>
</template>

<script>
    import GridItem from '@/components/GridItem'
    import GridLayout from '@/components/GridLayout'
    import ViewElement from '@/components/ViewElement'
    import {v4 as uuidv4} from 'uuid'
    let testLayout = [
        {x: 0, y: 0, w: 10, h: 1, i: '9b1deb4d-3b7d', resizable: true, draggable: true, static: false},
        // {x: 1, y: 0, w: 1, h: 1, i: '1', resizable: true, draggable: true},
    ]
    export default {
        name: 'Home',
        components: {
            GridLayout,
            GridItem,
            ViewElement
        },
        data() {
            return {
                layout: testLayout,
                draggable: true,
                resizable: true,
                responsive: true,
                preventCollision: false,
                rowHeight: 100,
                colNum: 100,
                index: 0,
                operateItem: ['可拖动', '可调整大小', '响应式']
            }
        },
        mounted(){
            this.index = this.layout.length
        },
        methods: {
            addItem(){
                let item = {x: 0, y: 0, w: 10, h: 1, i: uuidv4().slice(0, 10), whatever: 'bbb'}
                this.layout.push(item)
            },
            move(i, newX, newY){
                console.log('MOVE i=' + i + ', X=' + newX + ', Y=' + newY);
            },
            resize(i, newH, newW, newHPx, newWPx){
                console.log('RESIZE i=' + i + ', H=' + newH + ', W=' + newW + ', H(px)=' + newHPx + ', W(px)=' + newWPx);
            },
            moved(i, newX, newY){
                console.log('### MOVED i=' + i + ', X=' + newX + ', Y=' + newY);
            },
            resized(i, newH, newW, newHPx, newWPx){
                console.log('### RESIZED i=' + i + ', H=' + newH + ', W=' + newW + ', H(px)=' + newHPx + ', W(px)=' + newWPx);
            },
            layoutCreatedEvent(newLayout){
                console.log('Created layout: ', newLayout);
            },
            layoutBeforeMountEvent(newLayout){
                console.log('beforeMount layout: ', newLayout);
            },
            layoutMountedEvent(newLayout){
                console.log('Mounted layout: ', newLayout);
            },
            layoutReadyEvent(newLayout){
                console.log('Ready layout: ', newLayout);
            },
            layoutUpdatedEvent(newLayout){
                console.log('Updated layout: ', newLayout);
            },
            deleteGridItem(i){
                this.layout.map((item, index) => {
                    if(item.i === i){
                        this.layout.splice(index, 1)
                    }
                })
            }
        }
    }
</script>

<style lang="scss" scoped>
    .home-container {
        padding: 8px;
        .h-w-container{
            .set-h-w{
                margin-top: 10px;
                padding-top: 10px;
                margin-bottom: 10px;
                border-top: 2px solid #ccc;
                display: flex;
                justify-content: flex-start;
                align-items: center;
                .h-w{
                    display: flex;
                    justify-content: flex-start;
                    align-items: center;
                    .el-input{
                        width: 120px;
                        margin: 0 10px;
                    }
                }
            }
        }
        .comp{
            display: flex;
            justify-content: flex-start;
            .layout-item{
                margin-top: 10px;
                margin-right: 15px;
                display: flex;
                justify-content: flex-start;
                padding: 10px;
                border: 1px solid #ccc;
                .title{
                    font-weight: 700;
                    font-size: 16px;
                    margin-right: 10px;
                }
            }
        }
        .operate-btn {
            display: flex;
            justify-content: flex-end;
            padding: 10px 0;
        }
    }
</style>
