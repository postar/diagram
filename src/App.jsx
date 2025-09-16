import React, { useState, useEffect } from 'react';
import './App.css';

function App() {
  const [planes, setPlanes] = useState([]);
  const [planSeleccionado, setPlanSeleccionado] = useState(null);
  const [dataPlan, setDataPlan] = useState(null);
  const [progreso, setProgreso] = useState({});
  const [loading, setLoading] = useState(true);
  const [temaOscuro, setTemaOscuro] = useState(true); // Modo oscuro activado por defecto

  // Cargar planes disponibles
  useEffect(() => {
    const cargarPlanes = async () => {
      try {
        setLoading(true);
        const planesDisponibles = [
          {
            archivo: 'contador_público____plan_c822.json',
            nombre: 'Contador Público',
            codigo: 'C822'
          },
          {
            archivo: 'ingeniería_en_sistemas_informáticos____plan_t123.json',
            nombre: 'Ingeniería en Sistemas Informáticos',
            codigo: 'T123'
          }
        ];

        // Verificar cuáles archivos existen realmente
        const planesExistentes = [];
        for (const plan of planesDisponibles) {
          try {
            const response = await fetch(`/planes/${plan.archivo}`);
            if (response.ok) {
              planesExistentes.push(plan);
            }
          } catch (error) {
            console.warn(`No se pudo cargar el plan: ${plan.archivo}`);
          }
        }

        setPlanes(planesExistentes);
      } catch (error) {
        console.error('Error cargando planes:', error);
        setPlanes([]);
      } finally {
        setLoading(false);
      }
    };

    cargarPlanes();
  }, []);

  // Manejar tema oscuro
  useEffect(() => {
    const temaGuardado = localStorage.getItem('temaOscuro');
    if (temaGuardado !== null) {
      setTemaOscuro(JSON.parse(temaGuardado));
    }
  }, []);

  useEffect(() => {
    document.body.className = temaOscuro ? 'tema-oscuro' : 'tema-claro';
    localStorage.setItem('temaOscuro', JSON.stringify(temaOscuro));
  }, [temaOscuro]);

  // Función para cambiar tema
  const toggleTema = () => {
    setTemaOscuro(!temaOscuro);
  };

  // Cargar progreso guardado
  useEffect(() => {
    if (planSeleccionado) {
      const progresoGuardado = localStorage.getItem(`progreso_${planSeleccionado.codigo}`);
      if (progresoGuardado) {
        try {
          setProgreso(JSON.parse(progresoGuardado));
        } catch (error) {
          console.error('Error cargando progreso:', error);
          setProgreso({});
        }
      } else {
        setProgreso({});
      }
    }
  }, [planSeleccionado]);

  // Guardar progreso
  useEffect(() => {
    if (planSeleccionado && Object.keys(progreso).length > 0) {
      localStorage.setItem(`progreso_${planSeleccionado.codigo}`, JSON.stringify(progreso));
    }
  }, [progreso, planSeleccionado]);

  // Cargar datos del plan seleccionado
  const cargarPlan = async (plan) => {
    try {
      setLoading(true);
      const response = await fetch(`/planes/${plan.archivo}`);
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }
      const data = await response.json();
      setDataPlan(data);
      setPlanSeleccionado(plan);
    } catch (error) {
      console.error('Error cargando plan:', error);
      alert('Error cargando el plan de estudios. Por favor, intenta nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  // Cambiar estado de materia
  const cambiarEstadoMateria = (codigoMateria, nuevoEstado) => {
    setProgreso(prev => ({
      ...prev,
      [codigoMateria]: nuevoEstado
    }));
  };

  // Verificar si se pueden cursar las correlativas
  const puedesCursar = (materia) => {
    if (!materia.correlativas || materia.correlativas.length === 0) {
      return true;
    }

    // Las correlativas en el JSON pueden ser códigos o nombres de materias
    return materia.correlativas.every(correlativa => {
      // Buscar por código exacto primero
      let estadoCorrelativa = progreso[correlativa];
      
      // Si no se encuentra, buscar por nombre de materia (en caso de que las correlativas sean nombres)
      if (!estadoCorrelativa && dataPlan?.plan) {
        // Buscar el código de la materia por su nombre
        for (const periodo of dataPlan.plan) {
          const materiaCorrelativa = periodo.materias.find(m => 
            m.nombre.toLowerCase().includes(correlativa.toLowerCase()) ||
            correlativa.toLowerCase().includes(m.nombre.toLowerCase())
          );
          if (materiaCorrelativa) {
            estadoCorrelativa = progreso[materiaCorrelativa.codigo];
            break;
          }
        }
      }
      
      return estadoCorrelativa === 'completada';
    });
  };

  // Obtener color de materia según estado
  const getColorMateria = (codigoMateria, materia) => {
    const estado = progreso[codigoMateria] || 'sin-cursar';
    
    switch (estado) {
      case 'completada':
        return temaOscuro ? '#22c55e' : '#4caf50'; // Verde más brillante en oscuro
      case 'cursada':
        return temaOscuro ? '#f59e0b' : '#ff9800'; // Naranja más brillante en oscuro
      case 'sin-cursar':
        if (!puedesCursar(materia)) {
          return temaOscuro ? '#a855f7' : '#e1bee7'; // Morado más visible en oscuro
        }
        return temaOscuro ? '#334155' : '#f5f5f5'; // Gris más oscuro en modo oscuro
      default:
        return temaOscuro ? '#334155' : '#f5f5f5';
    }
  };

  // Calcular estadísticas
  const calcularEstadisticas = () => {
    if (!dataPlan?.plan) return { completadas: 0, cursadas: 0, total: 0 };
    
    // Contar el total de materias sumando las materias de todos los períodos
    const total = dataPlan.plan.reduce((acc, periodo) => acc + periodo.materias.length, 0);
    const completadas = Object.values(progreso).filter(estado => estado === 'completada').length;
    const cursadas = Object.values(progreso).filter(estado => estado === 'cursada').length;
    
    return { completadas, cursadas, total };
  };

  // Agrupar materias por período para mostrar como grilla
  const agruparMateriasPorPeriodo = () => {
    if (!dataPlan?.plan) return [];
    
    // El JSON tiene formato: { plan: [ { anio: 1, cuatrimestre: 1, materias: [...] } ] }
    const grilla = dataPlan.plan.map(periodo => ({
      anio: periodo.anio,
      cuatrimestre: `${periodo.cuatrimestre}° Cuatrimestre`,
      materias: periodo.materias.map(materia => ({
        codigo: materia.codigo,
        nombre: materia.nombre,
        correlativas: materia.correlativas || [],
        horas: materia.carga || materia.horas || 0
      })),
      key: `${periodo.anio}-${periodo.cuatrimestre}`
    }));
    
    // Ordenar por año y cuatrimestre
    grilla.sort((a, b) => {
      if (a.anio !== b.anio) {
        return a.anio - b.anio;
      }
      return a.cuatrimestre.localeCompare(b.cuatrimestre);
    });
    
    return grilla;
  };

  // Función para obtener información detallada de correlativas
  const obtenerInfoCorrelativas = (correlativas) => {
    return correlativas.map(cor => {
      const estadoCorr = progreso[cor] || 'sin-cursar';
      const estadoTexto = estadoCorr === 'completada' ? '✅ Completada' : 
                         estadoCorr === 'cursada' ? '🟡 Cursada' : '❌ Pendiente';
      return `• ${cor}: ${estadoTexto}`;
    }).join('\n');
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="loading-spinner"></div>
        <p>Cargando...</p>
      </div>
    );
  }

  if (!planSeleccionado) {
    return (
      <div className="plan-selector">
        <div className="container">
          <div className="selector-header">
            <div>
              <h1>Diagrama de Plan de Estudios</h1>
              <p>Selecciona tu plan de estudios para comenzar a trackear tu progreso</p>
            </div>
            <button 
              className="btn-theme"
              onClick={toggleTema}
              title={temaOscuro ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
            >
              {temaOscuro ? '☀️' : '🌙'}
            </button>
          </div>
          
          {planes.length === 0 ? (
            <div className="no-plans">
              <h3>No se encontraron planes</h3>
              <p>Asegúrate de que los archivos JSON estén en la carpeta /public/planes/</p>
            </div>
          ) : (
            <div className="planes-grid">
              {planes.map((plan) => (
                <div 
                  key={plan.codigo} 
                  className="plan-card"
                  onClick={() => cargarPlan(plan)}
                >
                  <h3>{plan.nombre}</h3>
                  <p>Código: {plan.codigo}</p>
                  <button className="btn-primary">Seleccionar Plan</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  const estadisticas = calcularEstadisticas();
  const grillaPlan = agruparMateriasPorPeriodo();

  return (
    <div className="app">
      <header className="header">
        <div className="container">
          <div className="header-content">
            <div className="header-left">
              <h1>{planSeleccionado.nombre}</h1>
              <div className="header-buttons">
                <button 
                  className="btn-secondary"
                  onClick={() => {
                    setPlanSeleccionado(null);
                    setDataPlan(null);
                  }}
                >
                  Cambiar Plan
                </button>
                <button 
                  className="btn-theme"
                  onClick={toggleTema}
                  title={temaOscuro ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
                >
                  {temaOscuro ? '☀️' : '🌙'}
                </button>
              </div>
            </div>
            <div className="estadisticas">
              <div className="stat">
                <span className="stat-value">{estadisticas.completadas}</span>
                <span className="stat-label">Completadas</span>
              </div>
              <div className="stat">
                <span className="stat-value">{estadisticas.cursadas}</span>
                <span className="stat-label">Cursadas</span>
              </div>
              <div className="stat">
                <span className="stat-value">{estadisticas.total}</span>
                <span className="stat-label">Total</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="main">
        <div className="container">
          {/* Leyenda */}
          <div className="leyenda">
            <div className="leyenda-item">
              <div className="color-box" style={{backgroundColor: '#4caf50'}}></div>
              <span>Completada</span>
            </div>
            <div className="leyenda-item">
              <div className="color-box" style={{backgroundColor: '#ff9800'}}></div>
              <span>Cursada</span>
            </div>
            <div className="leyenda-item">
              <div className="color-box" style={{backgroundColor: '#e1bee7'}}></div>
              <span>Correlativas pendientes</span>
            </div>
            <div className="leyenda-item">
              <div className="color-box" style={{backgroundColor: '#f5f5f5'}}></div>
              <span>Sin cursar</span>
            </div>
          </div>

          {/* Plan de estudios como tabla horizontal */}
          <div className="plan-tabla">
            {grillaPlan.map((fila) => (
              <div key={fila.key} className="fila-periodo">
                <div className="etiqueta-periodo">
                  <div className="periodo-info">
                    <span className="anio">Año {fila.anio}</span>
                    <span className="cuatrimestre">C{fila.cuatrimestre.charAt(0)}</span>
                  </div>
                </div>
                <div className="materias-horizontal">
                  {fila.materias.map((materia) => {
                    const puedeTomarMateria = puedesCursar(materia);
                    const colorMateria = getColorMateria(materia.codigo, materia);
                    
                    return (
                      <div
                        key={materia.codigo}
                        className="materia-celda"
                        style={{
                          backgroundColor: colorMateria,
                          borderColor: colorMateria !== '#f5f5f5' ? colorMateria : '#e2e8f0'
                        }}
                        title={`${materia.nombre} (${materia.horas}hs)${materia.correlativas?.length ? ` - Correlativas: ${materia.correlativas.join(', ')}` : ''}`}
                      >
                        <div className="materia-contenido">
                          <div className="materia-header-horizontal">
                            <span className="codigo-materia">{materia.codigo}</span>
                            <select 
                              className="selector-estado"
                              value={progreso[materia.codigo] || 'sin-cursar'}
                              onChange={(e) => cambiarEstadoMateria(materia.codigo, e.target.value)}
                              disabled={!puedeTomarMateria && progreso[materia.codigo] !== 'completada' && progreso[materia.codigo] !== 'cursada'}
                            >
                              <option value="sin-cursar">Sin cursar</option>
                              <option value="cursada">Cursada</option>
                              <option value="completada">Completada</option>
                            </select>
                          </div>
                          
                          <div className="nombre-materia">{materia.nombre}</div>
                          
                          <div className="info-materia">
                            <span className="horas">{materia.horas}hs</span>
                            {materia.correlativas && materia.correlativas.length > 0 && (
                              <span 
                                className="correlativas-icon" 
                                title={`Correlativas necesarias:\n${obtenerInfoCorrelativas(materia.correlativas)}`}
                              >
                                🔗
                              </span>
                            )}
                            {!puedeTomarMateria && (
                              <span 
                                className="bloqueada"
                                title={`No se puede cursar aún. Correlativas pendientes:\n${materia.correlativas?.filter(cor => progreso[cor] !== 'completada').map(cor => `• ${cor}`).join('\n') || 'Verificar correlativas'}`}
                              >
                                ⚠️
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;