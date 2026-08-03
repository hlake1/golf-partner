import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';

interface Props {
  title: string;
  content: string;
  onBack: () => void;
}

/**
 * Very small markdown-lite renderer for our legal docs.
 * Supports: # H1, ## H2, ### H3, **bold**, - bullet, | table |, --- rule.
 * Deliberately not using react-native-markdown-display so we can style
 * tightly and keep the bundle small.
 */
export default function LegalScreen({ title, content, onBack }: Props) {
  const blocks = renderMarkdown(content);

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} hitSlop={10} style={styles.backBtn}>
          <Text style={styles.backChevron}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {title}
        </Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        {blocks}
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

/**
 * Parse a subset of markdown into React elements.
 * Handles: headings (# ## ###), bold (**text**), horizontal rule (---),
 * bullet lists (- text), simple markdown tables (|col|col|).
 */
function renderMarkdown(md: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const lines = md.split('\n');
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Empty line
    if (trimmed === '') {
      i++;
      continue;
    }

    // Horizontal rule
    if (trimmed === '---') {
      out.push(<View key={key++} style={styles.hr} />);
      i++;
      continue;
    }

    // Headings
    if (trimmed.startsWith('### ')) {
      out.push(
        <Text key={key++} style={styles.h3}>
          {inlineBold(trimmed.slice(4))}
        </Text>
      );
      i++;
      continue;
    }
    if (trimmed.startsWith('## ')) {
      out.push(
        <Text key={key++} style={styles.h2}>
          {inlineBold(trimmed.slice(3))}
        </Text>
      );
      i++;
      continue;
    }
    if (trimmed.startsWith('# ')) {
      out.push(
        <Text key={key++} style={styles.h1}>
          {inlineBold(trimmed.slice(2))}
        </Text>
      );
      i++;
      continue;
    }

    // Bullet list — collect consecutive `- ` lines
    if (trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
      const bullets: string[] = [];
      while (
        i < lines.length &&
        (lines[i].trim().startsWith('- ') || lines[i].trim().startsWith('• '))
      ) {
        bullets.push(lines[i].trim().slice(2));
        i++;
      }
      out.push(
        <View key={key++} style={styles.list}>
          {bullets.map((b, idx) => (
            <View key={idx} style={styles.listItem}>
              <Text style={styles.listBullet}>•</Text>
              <Text style={styles.listText}>{inlineBold(b)}</Text>
            </View>
          ))}
        </View>
      );
      continue;
    }

    // Markdown table — start of a `|col|col|` block
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      const rows: string[][] = [];
      while (
        i < lines.length &&
        lines[i].trim().startsWith('|') &&
        lines[i].trim().endsWith('|')
      ) {
        const cells = lines[i]
          .trim()
          .slice(1, -1)
          .split('|')
          .map((c) => c.trim());
        rows.push(cells);
        i++;
      }
      // Skip separator row (|---|---|)
      const filtered = rows.filter((r) => !r.every((c) => /^-+$/.test(c)));
      out.push(
        <View key={key++} style={styles.table}>
          {filtered.map((row, rIdx) => (
            <View
              key={rIdx}
              style={[
                styles.tableRow,
                rIdx === 0 && styles.tableHeaderRow,
                rIdx === filtered.length - 1 && styles.tableRowLast,
              ]}
            >
              {row.map((cell, cIdx) => (
                <Text
                  key={cIdx}
                  style={[
                    styles.tableCell,
                    rIdx === 0 && styles.tableHeaderCell,
                  ]}
                >
                  {inlineBold(cell)}
                </Text>
              ))}
            </View>
          ))}
        </View>
      );
      continue;
    }

    // Default: paragraph
    out.push(
      <Text key={key++} style={styles.paragraph}>
        {inlineBold(trimmed)}
      </Text>
    );
    i++;
  }

  return out;
}

/**
 * Handle inline **bold** in a line. Returns a Text-friendly array.
 */
function inlineBold(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <Text key={idx} style={{ fontWeight: '700' }}>
          {part.slice(2, -2)}
        </Text>
      );
    }
    return <Text key={idx}>{part}</Text>;
  });
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  backBtn: {
    width: 40,
    alignItems: 'flex-start',
  },
  backChevron: {
    fontSize: 32,
    color: colors.primary,
    lineHeight: 32,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
    flex: 1,
    textAlign: 'center',
  },
  scroll: {
    padding: 20,
  },
  h1: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
    marginTop: 8,
    marginBottom: 12,
  },
  h2: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary,
    marginTop: 24,
    marginBottom: 8,
  },
  h3: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    marginTop: 16,
    marginBottom: 6,
  },
  paragraph: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 21,
    marginBottom: 10,
  },
  list: {
    marginBottom: 12,
    marginTop: 2,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  listBullet: {
    fontSize: 14,
    color: colors.primary,
    marginRight: 10,
    marginLeft: 4,
    lineHeight: 21,
  },
  listText: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    lineHeight: 21,
  },
  hr: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 20,
  },
  table: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    marginBottom: 16,
    overflow: 'hidden',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tableRowLast: {
    borderBottomWidth: 0,
  },
  tableHeaderRow: {
    backgroundColor: colors.surfaceElevated,
  },
  tableCell: {
    flex: 1,
    padding: 10,
    fontSize: 13,
    color: colors.text,
    lineHeight: 18,
  },
  tableHeaderCell: {
    fontWeight: '700',
    color: colors.textSecondary,
  },
});
