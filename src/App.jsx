import React, { useEffect, useState } from "react";
import ReactFlow, { Background, Controls, MiniMap } from "reactflow";
import "reactflow/dist/style.css";
import './App.css'

const STATUS = ["pendiente", "cursada", "aprobada"];

// Colores
const COLOR_VIOLETA = "#b39ddb"; // habilitada para cursar y rendir
const COLOR_VIOLETA_CLARO = "#e1bee7"; // habilitada solo para cursar
const COLOR_AMARILLO = "#ffe066"; // cursada
const COLOR_VERDE = "#8bc34a"; // aprobada
const COLOR_DEFAULT = "#fff";

function getStatusColor(status, enabled, habilitadaSoloCursada) {
  if (habilitadaSoloCursada) return COLOR_VIOLETA_CLARO;
  if (enabled) return COLOR_VIOLETA;
  switch (status) {
    case "cursada": return COLOR_AMARILLO;
    case "aprobada": return COLOR_VERDE;
    default: return COLOR_DEFAULT;
  }
}

const STORAGE_KEY = "estado_materias_plan";

function useColorScheme() {
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    setIsDark(mq.matches);
    const handler = e => setIsDark(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return isDark;
}

function App() {
  const [plan, setPlan] = useState([]);
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [nodeStatus, setNodeStatus] = useState({});
  const isDark = useColorScheme();

  // Cargar estado desde localStorage al iniciar
  useEffect(() => {
    fetch("/plan_ingenieria_sistemas.json")
      .then(res => res.json())
      .then(data => {
        setPlan(data);
        // Agrupar por año y cuatrimestre
        const agrupado = {};
        data.forEach(bloque => {
          if (!agrupado[bloque.anio]) agrupado[bloque.anio] = {};
          agrupado[bloque.anio][bloque.cuatrimestre] = bloque.materias;
        });
        // Inicializar estados
        const initialStatus = {};
        data.forEach(bloque => {
          bloque.materias.forEach(mat => {
            initialStatus[mat.codigo] = "pendiente";
          });
        });
        // Restaurar desde localStorage si existe
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          setNodeStatus({ ...initialStatus, ...parsed });
        } else {
          setNodeStatus(initialStatus);
        }
      });
  }, []);

  // Guardar estado en localStorage cada vez que cambie
  useEffect(() => {
    if (Object.keys(nodeStatus).length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nodeStatus));
    }
  }, [nodeStatus]);

  useEffect(() => {
    if (!plan.length) return;
    // Agrupar por año y cuatrimestre
    const agrupado = {};
    plan.forEach(bloque => {
      if (!agrupado[bloque.anio]) agrupado[bloque.anio] = {};
      agrupado[bloque.anio][bloque.cuatrimestre] = bloque.materias;
    });
    const nodes = [];
    const edges = [];
  // Responsive spacing
  const isMobile = window.innerWidth < 700;
  const xSpacing = isMobile ? 160 : 300;
  const ySpacing = isMobile ? 100 : 120;
    Object.entries(agrupado).forEach(([anio, cuatObj], anioIdx) => {
      Object.entries(cuatObj).forEach(([cuatrimestre, materias], cuatIdx) => {
        // Algoritmo para ubicar correlativas debajo de sus predecesoras
        // 1. Crear un mapa de materias por código
        const matMap = {};
        materias.forEach(m => { matMap[m.codigo] = m; });
        // 2. Calcular columna para cada materia
        const colMap = {};
        let colCounter = 0;
        // Materias sin correlativas: asignar columna nueva
        materias.forEach(m => {
          if (!m.correlativas.length) {
            colMap[m.codigo] = colCounter++;
          }
        });
        // Materias con correlativas: asignar columna igual a la correlativa principal (primera)
        materias.forEach(m => {
          if (m.correlativas.length) {
            const principal = m.correlativas[0];
            colMap[m.codigo] = colMap[principal] !== undefined ? colMap[principal] : colCounter++;
          }
        });
        // 3. Ordenar materias por columna y correlatividad
        const ordenadas = [...materias].sort((a, b) => {
          if (colMap[a.codigo] !== colMap[b.codigo]) return colMap[a.codigo] - colMap[b.codigo];
          // Si están en la misma columna, correlativas debajo
          if (a.correlativas.includes(b.codigo)) return 1;
          if (b.correlativas.includes(a.codigo)) return -1;
          return 0;
        });
        // 4. Ubicar cada materia en la grilla evitando superposición vertical
        const colYMap = {};
        ordenadas.forEach((mat, matIdx) => {
          const id = mat.codigo;
          let enabled = false;
          let habilitadaSoloCursada = false;
          if (mat.correlativas.length > 0) {
            // Si todas correlativas están "cursada" o "aprobada", se puede cursar
            const todasCursadaOAprobada = mat.correlativas.every(corr => ["cursada", "aprobada"].includes(nodeStatus[corr]));
            // Si todas correlativas están "aprobada", se puede rendir final
            const todasAprobada = mat.correlativas.every(corr => nodeStatus[corr] === "aprobada");
            if (todasAprobada) enabled = true;
            else if (todasCursadaOAprobada) habilitadaSoloCursada = true;
          } else {
            enabled = nodeStatus[id] === "pendiente";
          }
          // Determinar opciones permitidas
          let allowedStatus = ["pendiente"];
          if (enabled) allowedStatus = ["pendiente", "cursada", "aprobada"];
          else if (habilitadaSoloCursada) allowedStatus = ["pendiente", "cursada"];
          // Calcular posición vertical para evitar superposición en la columna
          const col = colMap[id];
          if (!colYMap[col]) colYMap[col] = 0;
          const yPos = 80 + ySpacing * (anioIdx * 2 + (cuatIdx)) + colYMap[col];
          colYMap[col] += (isMobile ? 220 : 260); // sumar espacio vertical para cada materia en la columna
          nodes.push({
            id,
            data: {
              label: (
                <div>
                  <strong>{mat.nombre}</strong>
                  <br />
                  <span style={{ fontSize: 12 }}>Año: {anio} | Cuat: {cuatrimestre}</span>
                  <br />
                  <select
                    value={nodeStatus[id]}
                    onChange={e => {
                      const nuevo = e.target.value;
                      if (!allowedStatus.includes(nuevo)) return;
                      const newStatus = { ...nodeStatus, [id]: nuevo };
                      setNodeStatus(newStatus);
                    }}
                  >
                    {allowedStatus.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              ),
              status: nodeStatus[id],
            },
            position: {
              x: 80 + xSpacing * col,
              y: yPos,
            },
            style: {
              background: getStatusColor(nodeStatus[id], enabled && nodeStatus[id] === "pendiente", habilitadaSoloCursada && nodeStatus[id] === "pendiente"),
              border: "1px solid #888",
              borderRadius: 8,
              padding: isMobile ? 6 : 10,
              minWidth: isMobile ? 120 : 240,
              maxWidth: isMobile ? 180 : 320,
              fontSize: isMobile ? 12 : 15,
              whiteSpace: 'normal',
              wordBreak: 'break-word',
            },
          });
          // Correlatividades
          mat.correlativas.forEach(corr => {
            edges.push({
              id: `${corr}->${id}`,
              source: corr,
              target: id,
              animated: true,
              style: { stroke: "#1976d2" },
            });
          });
        });
      });
    });
    setNodes(nodes);
    setEdges(edges);
  }, [plan, nodeStatus]);

  // Leyenda adaptada a tema
  const legendBg = isDark ? '#222' : '#f5f5f5';
  const legendColor = isDark ? '#eee' : '#222';
  const borderColor = isDark ? '#555' : '#888';

  const [showLegend, setShowLegend] = useState(false);
  return (
  <div style={{ width: "100vw", height: "100vh", position: "relative", minHeight: '100svh', overflow: 'auto' }}>
      <h2>Diagrama de Plan de Estudios</h2>
      <ReactFlow nodes={nodes} edges={edges} fitView>
        <Background />
        <MiniMap />
        <Controls />
      </ReactFlow>
      {/* Botón para mostrar/ocultar leyenda */}
      <div style={{ position: "absolute", left: 24, bottom: 24, zIndex: 20 }}>
        <button
          onClick={() => setShowLegend(v => !v)}
          style={{
            background: legendBg,
            color: legendColor,
            border: `1px solid ${borderColor}`,
            borderRadius: "50%",
            width: 48,
            height: 48,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 28,
            fontWeight: "bold",
            cursor: "pointer",
            boxShadow: isDark ? "0 2px 8px #111" : "0 2px 8px #ccc"
          }}
          aria-label={showLegend ? "Ocultar leyenda" : "Mostrar leyenda"}
          title={showLegend ? "Ocultar leyenda" : "Mostrar leyenda"}
        >
          <span style={{fontFamily: 'Arial, Helvetica, sans-serif'}}>I</span>
        </button>
        {/* Leyenda visible solo si showLegend es true */}
        {showLegend && (
          <div
            style={{
              marginTop: 8,
              padding: 12,
              background: legendBg,
              color: legendColor,
              borderRadius: 8,
              maxWidth: 340,
              border: `1px solid ${borderColor}`,
              textAlign: "left",
              boxShadow: isDark ? "0 2px 8px #111" : "0 2px 8px #ccc"
            }}
          >
            <strong style={{ display: "block", marginBottom: 8 }}>Leyenda de colores:</strong>
            <ul style={{ listStyle: 'none', paddingLeft: 0, margin: 0 }}>
              <li style={{ marginBottom: 4 }}><span style={{ background: COLOR_VERDE, border: `1px solid ${borderColor}`, borderRadius: 4, padding: '2px 12px', marginRight: 8, display: 'inline-block' }}></span> Aprobada (puede rendir final)</li>
              <li style={{ marginBottom: 4 }}><span style={{ background: COLOR_AMARILLO, border: `1px solid ${borderColor}`, borderRadius: 4, padding: '2px 12px', marginRight: 8, display: 'inline-block' }}></span> Cursada</li>
              <li style={{ marginBottom: 4 }}><span style={{ background: COLOR_VIOLETA, border: `1px solid ${borderColor}`, borderRadius: 4, padding: '2px 12px', marginRight: 8, display: 'inline-block' }}></span> Habilitada para cursar y rendir final</li>
              <li style={{ marginBottom: 4 }}><span style={{ background: COLOR_VIOLETA_CLARO, border: `1px solid ${borderColor}`, borderRadius: 4, padding: '2px 12px', marginRight: 8, display: 'inline-block' }}></span> Habilitada solo para cursar (no puede rendir final)</li>
              <li><span style={{ background: COLOR_DEFAULT, border: `1px solid ${borderColor}`, borderRadius: 4, padding: '2px 12px', marginRight: 8, display: 'inline-block' }}></span> Pendiente</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
