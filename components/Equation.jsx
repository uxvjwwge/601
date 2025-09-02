import { Text } from "react-native";

export default function Equation({ children }) {
  return (
    <Text
      style={{
        color: "#FFD580",       // amber to stand out
        fontSize: 14,           // a little larger than labels
        fontFamily: "monospace",// aligned math look
        marginVertical: 6,
      }}
    >
      {children}
    </Text>
  );
}
