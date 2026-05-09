import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AdminScreen from '../screens/AdminScreen';
import LoginScreen from '../screens/LoginScreen';
import MapScreen from '../screens/MapScreen';
import ReportScreen from '../screens/ReportScreen';
import RiskDashboard from '../screens/RiskDashboard';
import TreeScreen from '../screens/TreeScreen';

export type RootStackParamList = {
  Login: undefined;
  Map: undefined;
  Admin: undefined;
  RiskDashboard: undefined;
  Report: { zoneName?: string } | undefined;
  Tree: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Map" component={MapScreen} />
        <Stack.Screen name="Admin" component={AdminScreen} />
        <Stack.Screen name="RiskDashboard" component={RiskDashboard} />
        <Stack.Screen name="Report" component={ReportScreen} />
        <Stack.Screen name="Tree" component={TreeScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
