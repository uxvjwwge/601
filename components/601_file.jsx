// App.js — Expo React Native single-file app
// Build: expo init (blank), replace App.js with this file, then `npx expo start`
// Purpose: quick calculators for AIS / 60:1-rule style problems from your handout.
// Notes:
// - Uses a tiny formula engine so you can edit constants or add your own rules.
// - Includes physics-based turn-radius (bank-angle aware) plus the 60:1-style tools.
// - All units shown in each calculator; conversions done internally.

import { useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, Text, TextInput, View } from 'react-native';

// ---------- UI helpers ----------
const Section = ({ title, children }) => (
  <View style={{ marginBottom: 24, backgroundColor: '#0B1220', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#1E2A44' }}>
    <Text style={{ fontSize: 18, fontWeight: '700', color: 'white', marginBottom: 8 }}>{title}</Text>
    {children}
  </View>
);

const Row = ({ label, right, help }) => (
  <View style={{ marginVertical: 6 }}>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <Text style={{ color: '#C8D3F5', fontSize: 15, fontWeight: '600' }}>{label}</Text>
      {right}
    </View>
    {help ? <Text style={{ color: '#8EA4E3', marginTop: 4, fontSize: 12 }}>{help}</Text> : null}
  </View>
);

const NumInput = ({ value, onChange, placeholder }) => (
  <TextInput
    keyboardType="numeric"
    value={value}
    onChangeText={onChange}
    placeholder={placeholder}
    placeholderTextColor="#68759A"
    style={{ backgroundColor: '#0E1730', color: 'white', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, minWidth: 110, borderWidth: 1, borderColor: '#243056', textAlign: 'right' }}
  />
);

const Pill = ({ children }) => (
  <View style={{ backgroundColor: '#0E1730', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: '#27345E' }}>
    <Text style={{ color: 'white', fontVariant: ['tabular-nums'] }}>{children}</Text>
  </View>
);

const Button = ({ title, onPress }) => (
  <Pressable onPress={onPress} style={({ pressed }) => ({ backgroundColor: pressed ? '#2A3C72' : '#314785', paddingVertical: 10, borderRadius: 10, alignItems: 'center' })}>
    <Text style={{ color: 'white', fontWeight: '700' }}>{title}</Text>
  </Pressable>
);

// ---------- Math helpers ----------
const toNum = (v, fallback = 0) => {
  const n = parseFloat(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : fallback;
};
const ftPerNMFromDegrees = (deg) => 6076.12 * Math.tan((deg * Math.PI) / 180);

// Physics-based turn radius (works in any units):
// r_ft = V^2 / (g * tan(phi)), where V is ft/s, g=32.174 ft/s^2, phi in rad
const turnRadiusNM = (tasKt, bankDeg) => {
  const Vfts = toNum(tasKt) * 1.68781; // knots -> ft/s
  const g = 32.174;
  const phi = (toNum(bankDeg) * Math.PI) / 180;
  const r_ft = Vfts * Vfts / (g * Math.tan(phi || 0.0001));
  return r_ft / 6076.12; // ft -> NM
};

// ---------- Calculator definitions ----------
// Each calc declares: id, title, fields, compute({values}) => outputs

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
  },
  {
    id: 'pitch',
    title: '2) Pitch from Gradient',
    fields: [
      { key: 'gradientPercent', label: 'Gradient (%)' },
      { key: 'xCorrectionDeg', label: 'Correction x° (optional)' },
    ],
    compute: (v) => ({
      pitchDeg: toNum(v.gradientPercent) / 100 + toNum(v.xCorrectionDeg),
    }),
    outputs: [{ key: 'pitchDeg', label: 'Pitch to Fly (°)' }],
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
    const gradient = toNum(v.gradientFtPerNM, null);
    const tasMin = toNum(v.tasNMmin, null);
    const tasHr = toNum(v.tasNMhr, null);

    // Return null if gradient is missing
    if (gradient == null) return { vviFPM: null };

    // Determine TAS in NM/min
    let tasNMminFinal = null;
    if (tasMin != null) {
      tasNMminFinal = tasMin;
    } else if (tasHr != null) {
      tasNMminFinal = tasHr / 60;
    } else {
      return { vviFPM: null }; // no valid TAS provided
    }

    // Compute VVI in ft/min
    return { vviFPM: gradient * tasNMminFinal };
  },
  outputs: [
    { key: 'vviFPM', label: 'VVI (ft/min)' },
  ],
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
  },
  {
    id: 'loss90',
    title: '11) Distance Lost to a 90° Turn',
    fields: [
      { key: 'rNM', label: 'Turn Radius r (NM)' },
    ],
    compute: (v) => {
      const r = toNum(v.rNM);
      // chord for 90° is c = r*√2 * 2? Actually the straight segments if squared off would be 2r.
      // Handout note says “airplanes don’t square off a turn”; distance lost ≈ 2r − arc(90°).
      const arc = (90 / 360) * 2 * Math.PI * r; // quarter circumference
      const loss = 2 * r - arc;
      return { lossNM: loss };
    },
    outputs: [{ key: 'lossNM', label: 'Distance Lost (NM)' }],
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
  },
];

// ---------- App ----------
export default function App() {
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
        <Text style={{ color: '#A7B5E4', marginBottom: 18 }}>Quick calculators for gradients, TAS, turn geometry, and VDP. Units shown per field.</Text>

        {CALCS.map((calc) => {
          const out = calc.compute(values);
          return (
            <Section key={calc.id} title={calc.title}>
              {calc.fields.map((f) => (
                <Row key={f.key} label={f.label}>
                  <NumInput value={String(values[f.key] ?? '')} onChange={(t) => setField(f.key, t)} />
                </Row>
              ))}
              <View style={{ height: 10 }} />
              {calc.outputs.map((o) => (
                <Row key={o.key} label={o.label}>
                  <Pill>{Number.isFinite(out[o.key]) ? out[o.key].toFixed(3) : '—'}</Pill>
                </Row>
              ))}
            </Section>
          );
        })}

        <Section title="Unit Tips & Notes">
          <Text style={{ color: '#C8D3F5', lineHeight: 20 }}>
            • VVI = (ft/NM) × (NM/min) ⇒ ft/min. {'\n'}
            • IAS→TAS uses +5 kt per 1000 ft (rule-of-thumb). {'\n'}
            • Turn radius uses bank angle (default 30°). {'\n'}
            • Lead Radial ≈ 60·r / DME. Lead DME ≈ DME ± r. {'\n'}
            • VDP computed from HAT / (ft per NM at slope). 3° ≈ 318 ft/NM.
          </Text>
          <View style={{ height: 12 }} />
          <Button title="Clear All Inputs" onPress={() => setValues({})} />
        </Section>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}
