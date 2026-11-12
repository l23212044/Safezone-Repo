import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from './src/screens/LoginScreen';
import MapScreen from './src/screens/MapScreen';
import AdminScreen from './src/screens/AdminScreen';
import ReportScreen from './src/screens/ReportScreen';
import TreeScreen from './src/screens/TreeScreen';
import RiskDashboard from './src/screens/RiskDashboard';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>  
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Map"   component={MapScreen} />
        <Stack.Screen name="Admin" component={AdminScreen} />
        <Stack.Screen name="RiskDashboard" component={RiskDashboard} />
        <Stack.Screen name="Report" component={ReportScreen} />
        <Stack.Screen name="Tree" component={TreeScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}