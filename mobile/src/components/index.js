import axios from "axios";

// Placeholder components - create actual components as needed

export const Container = ({ children, style }) => {
  return <View style={style}>{children}</View>;
};

export const Button = ({ children, onPress, style }) => {
  return (
    <TouchableOpacity onPress={onPress} style={style}>
      {children}
    </TouchableOpacity>
  );
};

export const Card = ({ children, style }) => {
  return <View style={style}>{children}</View>;
};
