import Scene from './components/Scene'
import Controls from './components/Controls'
import CompassRose from './components/CompassRose'
import SidePanel from './components/SidePanel'

function App() {
  return (
    <div className="w-full h-full relative">
      <Scene />
      <Controls />
      <CompassRose />
      <SidePanel showAdmin={true} />
    </div>
  )
}

export default App
