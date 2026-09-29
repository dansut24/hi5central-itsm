import { useEffect, useState } from 'react'
import { ProductionTaskExperience } from './ProductionTaskExperience.jsx'
import { ProductionTaskNavigationBridge } from './ProductionTaskNavigationBridge.jsx'

export function ProductionRecordDetailRouter() {
  return <><ProductionTaskExperience /><ProductionTaskNavigationBridge /></>
}
