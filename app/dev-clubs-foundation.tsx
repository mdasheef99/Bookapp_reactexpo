import React from 'react';
import { ScrollView, View, Text, Pressable } from 'react-native';
import { ClubsFontProvider } from '@/features/clubs/theme/Fonts';
import { typography, colors, spacing, radii, screenInset, touchTarget, bookCovers, avatars } from '@/features/clubs/theme';

// Development-only Clubs V2 foundation preview.
// Deliberately placed OUTSIDE `(tabs)` so it never inherits the BookConnect
// bottom tab bar, and never linked from production navigation.
// Reachable only via direct URL in dev builds; renders nothing in production.
export default function DevClubsFoundationPreview() {
    if (!__DEV__) return null;

    return (
        <ClubsFontProvider>
            <ScrollView
                style={{ flex: 1, backgroundColor: colors.bg }}
                contentContainerStyle={{ padding: screenInset, paddingBottom: spacing.xxxl }}
            >
                {/* TYPOGRAPHY */}
                <Text style={typography.kicker}>Typography</Text>
                <View style={{ height: spacing.sm }} />
                <Text style={typography.clubTitle}>Club Title — The Midnight Readers</Text>
                <View style={{ height: spacing.md }} />
                <Text style={typography.sectionHeading}>Section Heading</Text>
                <View style={{ height: spacing.md }} />
                <Text style={typography.bookTitle}>Book Title — The Great Gatsby</Text>
                <View style={{ height: spacing.md }} />
                <Text style={typography.body}>
                    Body text — A readable paragraph demonstrating Inter&apos;s clarity at standard
                    body size. The quick brown fox jumps over the lazy dog.
                </Text>
                <View style={{ height: spacing.md }} />
                <Text style={typography.metadata}>Metadata — 12 members · Reading since Jan 2026</Text>

                <View style={{ height: spacing.xxl, backgroundColor: colors.divider, marginVertical: spacing.xl }} />

                {/* LONG CONTENT */}
                <Text style={typography.kicker}>Long Content Wrapping</Text>
                <View style={{ height: spacing.sm }} />
                <Text style={typography.clubTitle} testID="clubs-long-club-name">
                    An Extremely Long Club Name That Should Wrap Across Multiple Lines Gracefully Without Breaking Layout
                </Text>
                <View style={{ height: spacing.md }} />
                <Text style={typography.bookTitle} testID="clubs-long-book-title">
                    An Incredibly Long Book Title With Many Subtitle Components That Demands Wrapping Behavior
                </Text>
                <View style={{ height: spacing.md }} />
                <Text style={typography.body}>
                    {`A long body paragraph to verify wrapping and readability across the available space. `.repeat(8).trim()}
                </Text>

                <View style={{ height: spacing.xxl, backgroundColor: colors.divider, marginVertical: spacing.xl }} />

                {/* COLORS */}
                <Text style={typography.kicker}>Colors</Text>
                <View style={{ height: spacing.sm }} />
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
                    {(['bg', 'surface', 'surfaceSubtle', 'accent', 'success', 'warning', 'danger'] as const).map((key) => (
                        <View key={key} style={{ alignItems: 'center', marginBottom: spacing.md }}>
                            <View
                                style={{
                                    width: 64,
                                    height: 64,
                                    backgroundColor: colors[key],
                                    borderRadius: radii.medium,
                                    borderWidth: 1,
                                    borderColor: colors.border,
                                }}
                            />
                            <Text style={[typography.metadata, { marginTop: spacing.xs }]}>{key}</Text>
                        </View>
                    ))}
                </View>

                <View style={{ height: spacing.xxl, backgroundColor: colors.divider, marginVertical: spacing.xl }} />

                {/* SPACING */}
                <Text style={typography.kicker}>Spacing</Text>
                <View style={{ height: spacing.sm }} />
                {Object.entries(spacing).map(([key, value]) => (
                    <View key={key} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm }}>
                        <View
                            style={{
                                width: value,
                                height: 16,
                                backgroundColor: colors.accent,
                                borderRadius: radii.small,
                            }}
                        />
                        <Text style={[typography.metadata, { marginLeft: spacing.md }]}>
                            {key}: {value}px
                        </Text>
                    </View>
                ))}

                <View style={{ height: spacing.xxl, backgroundColor: colors.divider, marginVertical: spacing.xl }} />

                {/* RADII & BORDERS */}
                <Text style={typography.kicker}>Radii & Borders</Text>
                <View style={{ height: spacing.sm }} />
                <View style={{ flexDirection: 'row', gap: spacing.lg, marginBottom: spacing.lg }}>
                    {(['small', 'medium', 'large'] as const).map((key) => (
                        <View key={key} style={{ alignItems: 'center' }}>
                            <View
                                style={{
                                    width: 64,
                                    height: 64,
                                    backgroundColor: colors.surfaceSubtle,
                                    borderRadius: radii[key],
                                    borderWidth: 1,
                                    borderColor: colors.border,
                                }}
                            />
                            <Text style={[typography.metadata, { marginTop: spacing.xs }]}>{key} ({radii[key]}px)</Text>
                        </View>
                    ))}
                </View>
                <View
                    style={{
                        height: 1,
                        backgroundColor: colors.divider,
                        marginBottom: spacing.md,
                    }}
                />
                <Text style={typography.metadata}>↑ Hairline divider (1px)</Text>

                <View style={{ height: spacing.xxl, backgroundColor: colors.divider, marginVertical: spacing.xl }} />

                {/* TOUCH TARGET */}
                <Text style={typography.kicker}>Touch Target ({touchTarget}pt)</Text>
                <View style={{ height: spacing.sm }} />
                <Pressable
                    testID="clubs-foundation-sample-control"
                    accessibilityLabel="Foundation sample control"
                    accessibilityHint="Sample 44 point touch target"
                    accessibilityRole="button"
                    style={{
                        width: touchTarget,
                        height: touchTarget,
                        backgroundColor: colors.accent,
                        borderRadius: radii.medium,
                        justifyContent: 'center',
                        alignItems: 'center',
                    }}
                >
                    <Text style={{ color: colors.surface, fontFamily: 'Inter_600SemiBold', fontSize: 12 }}>
                        OK
                    </Text>
                </Pressable>

                <View style={{ height: spacing.xxl, backgroundColor: colors.divider, marginVertical: spacing.xl }} />

                {/* BOOK COVERS (2:3) */}
                <Text style={typography.kicker}>Book Covers (2:3)</Text>
                <View style={{ height: spacing.sm }} />
                <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: spacing.md }}>
                    {Object.entries(bookCovers).map(([key, { w, h }]) => (
                        <View key={key} style={{ alignItems: 'center' }} testID={`clubs-cover-${key}`}>
                            <View
                                style={{
                                    width: w,
                                    height: h,
                                    backgroundColor: colors.surfaceSubtle,
                                    borderRadius: radii.small,
                                    borderWidth: 1,
                                    borderColor: colors.border,
                                }}
                            />
                            <Text style={[typography.metadata, { marginTop: spacing.xs }]}>
                                {key}
                            </Text>
                            <Text style={typography.metadata}>{w}×{h}</Text>
                        </View>
                    ))}
                </View>

                <View style={{ height: spacing.xxl, backgroundColor: colors.divider, marginVertical: spacing.xl }} />

                {/* AVATARS */}
                <Text style={typography.kicker}>Avatars</Text>
                <View style={{ height: spacing.sm }} />
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                    {Object.entries(avatars).map(([key, size]) => (
                        <View key={key} style={{ alignItems: 'center' }} testID={`clubs-avatar-${key}`}>
                            <View
                                style={{
                                    width: size,
                                    height: size,
                                    borderRadius: size / 2,
                                    backgroundColor: colors.accentSubtle,
                                    borderWidth: 1,
                                    borderColor: colors.accent,
                                }}
                            />
                            <Text style={[typography.metadata, { marginTop: spacing.xs }]}>
                                {key} ({size})
                            </Text>
                        </View>
                    ))}
                </View>
            </ScrollView>
        </ClubsFontProvider>
    );
}
