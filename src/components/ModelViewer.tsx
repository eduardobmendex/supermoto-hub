import { Suspense, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, useGLTF, Center, Bounds, ContactShadows, Environment, Lightformer } from "@react-three/drei";

function Model({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  return (
    <Bounds fit clip observe margin={1.2}>
      <Center>
        <primitive object={scene} />
      </Center>
    </Bounds>
  );
}

export default function ModelViewer({ url }: { url: string }) {
  const [ready, setReady] = useState(false);
  return (
    <div className="relative h-full w-full" data-scene-ready={ready || undefined}>
      <Canvas camera={{ position: [0, 0.6, 3], fov: 40 }} dpr={[1, 2]} onCreated={() => setReady(true)}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[3, 5, 2]} intensity={1.6} />
        <Environment resolution={256}>
          <Lightformer intensity={2} position={[0, 5, 0]} scale={[10, 10, 1]} />
          <Lightformer intensity={1.5} color="#ff8a3d" position={[-5, 1, -1]} rotation-y={Math.PI / 2} scale={[20, 1, 1]} />
          <Lightformer intensity={1} position={[5, 1, 1]} rotation-y={-Math.PI / 2} scale={[20, 1, 1]} />
        </Environment>
        <Suspense fallback={null}>
          <Model url={url} />
        </Suspense>
        <ContactShadows position={[0, -0.8, 0]} opacity={0.5} blur={2.5} scale={6} />
        <OrbitControls makeDefault enablePan enableDamping autoRotate autoRotateSpeed={0.8} minDistance={0.5} maxDistance={10} />
      </Canvas>
    </div>
  );
}
