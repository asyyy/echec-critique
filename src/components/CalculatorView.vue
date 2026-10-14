<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import CalculatorPad from '@/components/CalculatorPad.vue'

const { t } = useI18n()
</script>

<template>
  <div id="search-calculator" class="calculator-view search-target">
    <h2>{{ t('calculator.title') }}</h2>
    <CalculatorPad />
  </div>
</template>

<style scoped>
.calculator-view {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

h2 {
  font-size: 1.3rem;
  font-weight: 700;
}
</style>
