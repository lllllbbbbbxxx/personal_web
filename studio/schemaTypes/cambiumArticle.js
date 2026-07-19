import {defineArrayMember, defineField, defineType} from "sanity"

export const cambiumArticle = defineType({
  name: "cambiumArticle",
  title: "Cambium 文章",
  type: "document",
  fields: [
    defineField({
      name: "title",
      title: "标题",
      type: "string",
      validation: (rule) => rule.required().max(80),
    }),
    defineField({
      name: "slug",
      title: "文章地址",
      type: "slug",
      description: "点击 Generate 自动生成，发布前请确认。",
      options: {source: "title", maxLength: 96},
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "excerpt",
      title: "摘要",
      type: "text",
      rows: 4,
      validation: (rule) => rule.required().max(240),
    }),
    defineField({
      name: "body",
      title: "正文",
      type: "array",
      of: [
        defineArrayMember({
          type: "block",
          styles: [
            {title: "正文", value: "normal"},
            {title: "二级标题", value: "h2"},
            {title: "三级标题", value: "h3"},
            {title: "引用", value: "blockquote"},
          ],
          marks: {
            annotations: [
              {
                name: "link",
                title: "链接",
                type: "object",
                fields: [
                  defineField({
                    name: "href",
                    title: "URL",
                    type: "url",
                    validation: (rule) =>
                      rule.uri({scheme: ["http", "https"]}),
                  }),
                  defineField({
                    name: "blank",
                    title: "在新窗口打开",
                    type: "boolean",
                    initialValue: true,
                  }),
                ],
              },
            ],
          },
        }),
      ],
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "publishedAt",
      title: "发布日期",
      type: "datetime",
      initialValue: () => new Date().toISOString(),
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "featured",
      title: "重点展示",
      description: "开启后文章会排在 Cambium 列表前面。",
      type: "boolean",
      initialValue: false,
    }),
    defineField({
      name: "evolution",
      title: "演化时间线",
      type: "array",
      of: [
        defineArrayMember({
          name: "evolutionEntry",
          title: "一次修改",
          type: "object",
          fields: [
            defineField({
              name: "date",
              title: "日期",
              type: "date",
              validation: (rule) => rule.required(),
            }),
            defineField({
              name: "label",
              title: "版本标签",
              type: "string",
              placeholder: "例如：v1 · 第一版",
            }),
            defineField({
              name: "note",
              title: "修改说明",
              type: "text",
              rows: 3,
              validation: (rule) => rule.required().max(240),
            }),
          ],
          preview: {
            select: {title: "label", subtitle: "note"},
          },
        }),
      ],
    }),
  ],
  orderings: [
    {
      title: "发布日期（新到旧）",
      name: "publishedAtDesc",
      by: [{field: "publishedAt", direction: "desc"}],
    },
  ],
  preview: {
    select: {
      title: "title",
      subtitle: "excerpt",
    },
  },
})
