<template>
    <div class="view-element-container">
        {{text}}
    </div>
</template>

<script>
    export default {
        name: "ViewElement",
        props: {
            text: {
                type: String,
                default: 'x'
            }
        },
        mounted(){
            console.log('### ' + this.text + ' ready!');
        }
    }
</script>

<style scoped>

</style>
