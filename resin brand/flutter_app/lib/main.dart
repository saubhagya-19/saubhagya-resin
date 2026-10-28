import 'package:flutter/material.dart';

void main() {
  runApp(const ResinBrandApp());
}

class ResinBrandApp extends StatelessWidget {
  const ResinBrandApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Saubhagya Resin Art',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: Colors.amber),
        useMaterial3: true,
      ),
      home: const FlutterSetupHome(),
    );
  }
}

class FlutterSetupHome extends StatelessWidget {
  const FlutterSetupHome({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Saubhagya Resin Art')),
      body: const Center(
        child: Text('Flutter setup is ready.'),
      ),
    );
  }
}
