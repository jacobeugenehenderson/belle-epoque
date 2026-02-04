import Scene from './components/Scene'
import Controls from './components/Controls'
import Almanac from './components/Almanac'
import CompassRose from './components/CompassRose'

function App() {
  return (
    <div className="w-full h-full relative">
      <Scene />
      <Controls />
      <Almanac showAdmin={true} />
      <CompassRose />
    </div>
  )
}

export default App
