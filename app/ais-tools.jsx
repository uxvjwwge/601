import { useState } from 'react';
import { SafeAreaView, ScrollView, Text, View } from 'react-native';
import Button from '../components/Button';
import CalculatorSection from '../components/CalculatorSection';
import Equation from "../components/Equation";
import NumInput from '../components/NumInput';
import Pill from '../components/Pill';
import Row from '../components/Row';

// ---------- Math helpers ----------
const toNum = (v, fallback = 0) => {
  const n = parseFloat(String(v ?? '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : fallback;
};

const ftPerNMFromDegrees = (deg) => 6076.12 * Math.tan((deg * Math.PI) / 180);

// Physics-based turn radius (works in any units):
const turnRadiusNM = (tasKt, bankDeg) => {
  const Vfts = toNum(tasKt) * 1.68781; // knots -> ft/s
  const g = 32.174;
  const phi = (toNum(bankDeg) * Math.PI) / 180;
  const r_ft = (Vfts * Vfts) / (g * Math.tan(phi || 0.0001));
  return r_ft / 6076.12; // ft -> NM
};

// ---------- Calculator definitions ----------
const CALCS = [
  {
    id: 'gradient',
    title: '1) Gradient (ft/NM)',
    fields: [
      { key: 'altitudeChangeFt', label: 'Altitude Change (ft)' },
      { key: 'distanceNM', label: 'Distance Traveled (NM)' },
    ],
    compute: (v) => ({
      gradientFtPerNM: toNum(v.altitudeChangeFt) / Math.max(1e-9, toNum(v.distanceNM)),
    }),
    outputs: [{ key: 'gradientFtPerNM', label: 'Gradient (ft/NM)' }],
    equation: "Gradient (ft/NM) = Δ Altitude (ft) ÷ Distance (NM)",
  },
  {
    id: 'pitch',
    title: '2) Pitch from Gradient',
    fields: [
      { key: 'gradientPercent', label: 'Gradient (%)' },
      { key: 'xCorrectionDeg', label: 'Level Pitch Attitude x° (optional)' },
    ],
    compute: (v) => ({
      pitchDeg: toNum(v.gradientPercent) / 100 + toNum(v.xCorrectionDeg),
    }),
    outputs: [{ key: 'pitchDeg', label: 'Pitch to Fly (°)' }],
    equation: "Pitch (°) = (Gradient (%) ÷ 100) + Level Pitch (°)",
  },
  {
    id: 'ias2tas',
    title: '3) IAS → TAS (and NM/min)',
    fields: [
      { key: 'iasKt', label: 'IAS (kt)' },
      { key: 'pressureAltFt', label: 'Altitude (ft, ~PA)' },
    ],
    compute: (v) => {
      const ktas = toNum(v.iasKt) + 5 * (toNum(v.pressureAltFt) / 1000);
      return {
        ktas,
        tasNMmin: ktas / 60,
      };
    },
    outputs: [
      { key: 'ktas', label: 'TAS (kt)' },
      { key: 'tasNMmin', label: 'TAS (NM/min)' },
    ],
    equation: "TAS (kt) ≈ IAS + 5 × (Altitude ÷ 1000)\nTAS (NM/min) = TAS ÷ 60",
  },
  {
    id: 'avgTas',
    title: '4) Average TAS',
    fields: [
      { key: 'tasLow', label: 'TAS @ lower alt (kt)' },
      { key: 'tasHigh', label: 'TAS @ higher alt (kt)' },
    ],
    compute: (v) => {
      const avg = (toNum(v.tasLow) + toNum(v.tasHigh)) / 2;
      return { avgTasKt: avg, avgTasNMmin: avg / 60 };
    },
    outputs: [
      { key: 'avgTasKt', label: 'Average TAS (kt)' },
      { key: 'avgTasNMmin', label: 'Average TAS (NM/min)' },
    ],
    equation: "Average TAS = (TAS_low + TAS_high) ÷ 2\nAverage TAS (NM/min) = Average TAS ÷ 60",
  },
  {
   id: 'vvi',
  title: '5) VVI from Gradient & TAS',
  fields: [
    { key: 'gradientFtPerNM', label: 'Gradient (ft/NM)' },
    { key: 'tasNMmin', label: 'TAS (NM/min, optional)', optional: true },
    { key: 'tasNMhr', label: 'TAS (NM/hr, optional)', optional: true },
  ],
  compute: (v) => {
    const gradient = toNum(v.gradientFtPerNM);
    const tasNMmin = toNum(v.tasNMmin, null);
    const tasNMhr = toNum(v.tasNMhr, null);

    if (!Number.isFinite(gradient)) return { vviFPM: null };

    let tasFinal = null;
    if (Number.isFinite(tasNMmin)) {
      tasFinal = tasNMmin;
    } else if (Number.isFinite(tasNMhr)) {
      tasFinal = tasNMhr / 60;
    } else {
      return { vviFPM: null };
    }

    return { vviFPM: gradient * tasFinal };
  },
  outputs: [{ key: 'vviFPM', label: 'VVI (ft/min)' }],
  equation: "VVI (ft/min) = Gradient (ft/NM) × TAS (NM/min)\n(or TAS (NM/hr) ÷ 60)",
},

  {
    id: 'turnRadius',
    title: '6) Turn Radius (bank-aware physics)',
    fields: [
      { key: 'tasKt', label: 'TAS (kt)' },
      { key: 'bankDeg', label: 'Bank Angle (°)', default: '30' },
    ],
    compute: (v) => ({ rNM: turnRadiusNM(toNum(v.tasKt), toNum(v.bankDeg)) }),
    outputs: [{ key: 'rNM', label: 'Turn Radius (NM)' }],
    equation: "r (NM) = (V² ÷ (g × tan φ)) ÷ 6076.12",
  },
  {
    id: 'leadRadial',
    title: '7) Lead Radial (deg)',
    fields: [
      { key: 'rNM', label: 'Turn Radius r (NM)' },
      { key: 'arcingDME', label: 'Arcing DME (NM)' },
      { key: 'interceptRadial', label: 'Intercept Radial (deg)' },
    ],
    compute: (v) => {
      const lead = (60 * toNum(v.rNM)) / Math.max(1e-9, toNum(v.arcingDME));
      return { leadDegMinus: toNum(v.interceptRadial) - lead, leadDegPlus: toNum(v.interceptRadial) + lead };
    },
    outputs: [
      { key: 'leadDegMinus', label: 'Lead Radial (−) deg' },
      { key: 'leadDegPlus', label: 'Lead Radial (+) deg' },
    ],
    equation: "Lead (°) = (60 × r) ÷ Arcing DME",
  },
  {
    id: 'leadDME',
    title: '8) Lead DME (NM)',
    fields: [
      { key: 'arcingDME', label: 'Arcing DME (NM)' },
      { key: 'rNM', label: 'Turn Radius r (NM)' },
    ],
    compute: (v) => ({ inbound: toNum(v.arcingDME) - toNum(v.rNM), outbound: toNum(v.arcingDME) + toNum(v.rNM) }),
    outputs: [
      { key: 'inbound', label: 'Lead DME inbound (NM)' },
      { key: 'outbound', label: 'Lead DME outbound (NM)' },
    ],
    equation: "Lead DME = Arcing DME ± r",
  },
  {
    id: 'arcDistance',
    title: '9) Arcing Distance (NM)',
    fields: [
      { key: 'startRadial', label: 'Starting Radial (deg)' },
      { key: 'endRadial', label: 'Ending Radial (deg)' },
      { key: 'arcingDME', label: 'Arcing DME (NM)' },
    ],
    compute: (v) => ({
      arcNM: (Math.abs(toNum(v.startRadial) - toNum(v.endRadial)) / 60) * toNum(v.arcingDME),
    }),
    outputs: [{ key: 'arcNM', label: 'Arcing Distance (NM)' }],
    equation: "Arc Distance (NM) = (|Start − End| ÷ 60) × Arcing DME",
  },
  {
    id: 'turningDistance',
    title: '10) Turning Distance for N°',
    fields: [
      { key: 'degrees', label: 'Turn Amount (deg)' },
      { key: 'rNM', label: 'Turn Radius r (NM)' },
    ],
    compute: (v) => ({
      turnDistNM: (toNum(v.degrees) / 360) * 2 * Math.PI * toNum(v.rNM),
    }),
    outputs: [{ key: 'turnDistNM', label: 'Turning Distance (NM)' }],
    equation: "Turn Distance (NM) = (Degrees ÷ 360) × 2πr",
  },
  {
    id: 'loss90',
    title: '11) Distance Lost to a 90° Turn',
    fields: [
      { key: 'rNM', label: 'Turn Radius r (NM)' },
    ],
    compute: (v) => {
      const r = toNum(v.rNM);
      const arc = (90 / 360) * 2 * Math.PI * r;
      const loss = 2 * r - arc;
      return { lossNM: loss };
    },
    outputs: [{ key: 'lossNM', label: 'Distance Lost (NM)' }],
    equation: "Loss (NM) = (2 × r) − (πr ÷ 2)",
  },
  {
    id: 'climbDescend',
    title: '12) Distance to Climb/Descend (NM)',
    fields: [
      { key: 'altitudeToClimbFt', label: 'Δ Altitude (ft)' },
      { key: 'climbGradientFtPerNM', label: 'Climb/Descent Gradient (ft/NM)' },
    ],
    compute: (v) => ({ nm: toNum(v.altitudeToClimbFt) / Math.max(1e-9, toNum(v.climbGradientFtPerNM)) }),
    outputs: [{ key: 'nm', label: 'Distance (NM)' }],
    equation: "Distance (NM) = Δ Altitude (ft) ÷ Gradient (ft/NM)",
  },
  {
    id: 'vdp',
    title: '13) VDP (NM from Threshold)',
    fields: [
      { key: 'hatFt', label: 'HAT (ft)' },
      { key: 'slopeDeg', label: 'Glideslope/VDA (deg)' },
    ],
    compute: (v) => {
      const ftPerNM = ftPerNMFromDegrees(toNum(v.slopeDeg));
      return { vdpNM: toNum(v.hatFt) / Math.max(1e-9, ftPerNM), ftPerNM };
    },
    outputs: [
      { key: 'vdpNM', label: 'VDP (NM)' },
      { key: 'ftPerNM', label: 'Slope (ft/NM)' },
    ],
    equation: "VDP (NM) = HAT (ft) ÷ Slope (ft/NM)\nSlope (ft/NM) = 6076.12 × tan(Slope °)",
  },
  {
  id: 'timeOut',
  title: '14) Distance for 3-2-1 (and Custom) Minutes Out',
  fields: [
    { key: 'groundSpeedKt', label: 'Groundspeed (kt)' },
    { key: 'customMinutes', label: 'Custom Minutes Out (optional)' },
  ],
  compute: (v) => {
    const gs = toNum(v.groundSpeedKt);
    const nmPerMin = gs / 60; // NM per minute
    const threeMin = nmPerMin * 3;
    const twoMin = nmPerMin * 2;
    const oneMin = nmPerMin * 1;
    const custom = toNum(v.customMinutes);

    return {
      dist3min: threeMin,
      dist2min: twoMin,
      dist1min: oneMin,
      distCustom: custom ? nmPerMin * custom : null,
    };
  },
  outputs: [
    { key: 'dist3min', label: '3 min out (NM)' },
    { key: 'dist2min', label: '2 min out (NM)' },
    { key: 'dist1min', label: '1 min out (NM)' },
    { key: 'distCustom', label: 'Custom min out (NM)' },
  ],
  equation: "Distance (NM) = (Groundspeed ÷ 60) × Time (min)",
},
];

// ---------- Screen ----------
export default function AISToolsScreen() {
  const [values, setValues] = useState(() => {
    const v = {};
    CALCS.forEach((c) => c.fields.forEach((f) => (v[f.key] = f.default ?? '')));
    return v;
  });

  const setField = (k, val) => setValues((p) => ({ ...p, [k]: val }));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#060B1A' }}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Text style={{ color: 'white', fontSize: 24, fontWeight: '800', marginBottom: 6 }}>AIS 60:1 Tools</Text>
        <Text style={{ color: '#A7B5E4', marginBottom: 18 }}>
          Quick calculators for gradients, TAS, turn geometry, and VDP. Units shown per field.
        </Text>

        {CALCS.map((calc) => {
          const out = calc.compute(values);
          return (
            <CalculatorSection key={calc.id} title={calc.title}>
              {/* Inputs */}
              {calc.fields.map((f) => (
                <Row key={f.key} label={f.label}>
                  <NumInput
                    placeholder=""
                    value={String(values[f.key] ?? '')}
                    onChange={(t) => setField(f.key, t)}
                  />
                </Row>
              ))}

              {/* 👉 Equation goes here */}
              {calc.equation && <Equation>{calc.equation}</Equation>}

              <View style={{ height: 10 }} />

              {/* Outputs */}
              {calc.outputs.map((o) => (
                <Row key={o.key} label={o.label}>
                  <Pill>{Number.isFinite(out[o.key]) ? out[o.key].toFixed(3) : '—'}</Pill>
                </Row>
              ))}
            </CalculatorSection>
          );
        })}

        <CalculatorSection title="Unit Tips & Notes">
          <Text style={{ color: '#C8D3F5', lineHeight: 20 }}>
            • VVI = (ft/NM) × (NM/min) ⇒ ft/min.{'\n'}
            • IAS→TAS uses +5 kt per 1000 ft (rule-of-thumb).{'\n'}
            • Turn radius uses bank angle (default 30°).{'\n'}
            • Lead Radial ≈ 60·r / DME. Lead DME ≈ DME ± r.{'\n'}
            • VDP computed from HAT / (ft per NM at slope). 3° ≈ 318 ft/NM.
          </Text>
          <View style={{ height: 12 }} />
          <Button title="Clear All Inputs" onPress={() => setValues({})} />
        </CalculatorSection>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}
