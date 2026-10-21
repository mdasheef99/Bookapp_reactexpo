import React, { useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { PassageCardPreview } from '@/components/library/export';

const LONG_EN = 'The river bent slowly through the valley, carrying with it the quiet patience of old stones and the memory of rain. Travellers who stopped at its edge often spoke of a strange calm, as if the water itself were listening. In the village above, bakers rose before dawn to knead bread while the mist lifted from the fields, and children learned the names of birds before they learned the names of kings. Every autumn the orchard keepers gathered fallen apples in wicker baskets, singing the same unhurried songs their grandparents once sang, and every winter the lamps were lit early so that stories could begin before the cold crept under the doors. Nothing here was hurried, and yet nothing was left undone; the days folded neatly into one another like linen in a cedar chest, smelling faintly of smoke and lavender. When spring returned, the river swelled with melted snow, and the whole valley seemed to breathe out at once, remembering that patience is also a kind of courage, and that the longest journeys are made of small and ordinary steps taken faithfully.';
const FIXTURES: Record<string, { quote: string; title: string; author?: string | null; page?: number | null }> = {
  A: { quote: 'The mass of men lead lives of quiet desperation.', title: 'Walden', author: 'Henry David Thoreau', page: 8 },
  B: { quote: LONG_EN, title: 'Long Test', author: 'Test Author', page: 120 },
  C: { quote: 'यह एक हिंदी उद्धरण है जो कार्ड पर दिखना चाहिए। '.repeat(3).trim(), title: 'किताब की कहानी', author: null, page: null },
  D: { quote: 'ಇದು ಕನ್ನಡ ಉದ್ಧರಣ ಪರೀಕ್ಷೆ. '.repeat(24).trim(), title: 'ಪುಸ್ತಕ ಕಥೆ', author: null, page: null },
  E: { quote: '我们读书是为了知道自己并不孤单'.repeat(25), title: '测试', author: null, page: null },
  F: { quote: Array.from({ length: 20 }, (_, i) => `Line ${i + 1}`).join('\n'), title: 'Many Lines', author: null, page: null },
};

export default function NativeCardProof() {
  const [open, setOpen] = useState<string | null>(null);
  const f = open ? FIXTURES[open] : null;
  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#fff', paddingTop: 40 }}>
      <View style={{ padding: 8 }}>
        <Text style={{ fontWeight: 'bold', color: '#000' }}>Card proof</Text>
        {Object.keys(FIXTURES).map(k => (
          <TouchableOpacity key={k} testID={`btn-${k}`} accessibilityLabel={`btn-${k}`} onPress={() => setOpen(k)}
            style={{ backgroundColor: '#246', padding: 14, margin: 4 }}>
            <Text style={{ color: '#fff' }}>Open {k}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {f && <PassageCardPreview visible onClose={() => setOpen(null)} quote={f.quote} title={f.title} author={f.author ?? null} page={f.page ?? null} />}
    </ScrollView>
  );
}
