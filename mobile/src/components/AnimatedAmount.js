/**
 * AnimatedAmount — counts from the previous value to the new value.
 *
 * Drop-in replacement for <Text> when displaying numeric amounts.
 *
 * Props:
 *   value      {number}   The target number to animate to
 *   formatter  {function} (n: number) => string  — how to display the number
 *   style      {object}   Text style (passed straight through)
 *   duration   {number}   Animation duration in ms (default 700)
 *
 * Example:
 *   <AnimatedAmount
 *     value={totalCollected}
 *     formatter={(n) => "₱" + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
 *     style={styles.metricAmount}
 *   />
 */

import React, { useRef, useEffect, useState } from "react";
import { Animated, Easing, Text } from "react-native";

const AnimatedAmount = ({
  value = 0,
  formatter,
  style,
  duration = 700,
  ...rest
}) => {
  const fromRef = useRef(0); // always count from 0 on first mount
  const animVal = useRef(new Animated.Value(0));
  const animRef = useRef(null);

  const fmt = formatter || ((n) => String(Math.round(n)));

  const [display, setDisplay] = useState(fmt(0));

  useEffect(() => {
    const from = fromRef.current;
    const to = value;

    // Nothing to animate
    if (from === to) {
      setDisplay(fmt(to));
      return;
    }

    // Stop any in-progress animation
    if (animRef.current) animRef.current.stop();

    animVal.current.setValue(0);

    const anim = Animated.timing(animVal.current, {
      toValue: 1,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });

    animRef.current = anim;

    const id = animVal.current.addListener(({ value: t }) => {
      const current = from + (to - from) * t;
      setDisplay(fmt(current));
    });

    anim.start(({ finished }) => {
      animVal.current.removeListener(id);
      if (finished) {
        fromRef.current = to;
        setDisplay(fmt(to));
      }
    });

    return () => {
      animVal.current.removeListener(id);
    };
  }, [value]);

  return (
    <Text style={style} {...rest}>
      {display}
    </Text>
  );
};

export default AnimatedAmount;
